#!/usr/bin/env node
/**
 * Làm giàu dữ liệu ghi nhớ cho tiếng Hàn / tiếng Trung bằng Claude, có kiểm chứng bằng Unihan.
 *
 *   node scripts/ai-enrich-zh-ko.mjs --unihan <thư mục Unihan đã giải nén> [--limit N] [--dry]
 *
 * Bước 1 — tiếng Hàn (data/ko.json): mỗi từ CHƯA có mẹo nhớ hoặc chưa xác định được Hanja cả từ → AI trả
 *   { hanja, mnemonicVn }. Hanja được KIỂM CHỨNG: từng chữ phải có âm Hangul (Unihan kHangul) khớp đúng âm
 *   tiết tương ứng (cho phép luật đầu âm 두음법칙: 력→역, 녀→여, 로→노…). Sai → hỏi lại 1 lần, vẫn sai → bỏ.
 *   Từ thuần Hàn (không có Hanja) chỉ nhận mẹo nhớ. Ghi trường `hanja` + `mnemonicVn` vào data/ko.json.
 * Bước 2 — Hán Việt: chữ Hán xuất hiện trong từ tiếng Trung (mọi trục) và trong Hanja vừa có, mà bảng âm
 *   Hán Việt soạn tay (RootEntry.hanViet) chưa có → AI điền, ghi data/hanviet-extra.json.
 *
 * Cần ANTHROPIC_API_KEY (đọc từ .env.local nếu chưa có trong môi trường).
 */
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { loadKHangul, validHanja } from "./lib/hanjaCheck.mjs";

const MODEL = "claude-opus-5-5";
const KO_BATCH = 20;
const HV_BATCH = 120;
const CONCURRENCY = 4;

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const UNIHAN = arg("--unihan");
const LIMIT = arg("--limit") ? Number(arg("--limit")) : Infinity;
const DRY = args.includes("--dry");
if (!UNIHAN) {
  console.error("Thiếu --unihan <thư mục>");
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY && fs.existsSync(".env.local")) {
  // .env.local có thể khai báo trùng key (dòng trống trước, dòng có giá trị sau) — lấy giá trị cuối cùng khác rỗng
  const value = fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.startsWith("ANTHROPIC_API_KEY="))
    .map((l) => l.slice("ANTHROPIC_API_KEY=".length).trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean)
    .pop();
  if (value) process.env.ANTHROPIC_API_KEY = value;
}
const client = new Anthropic();

// ── Unihan: âm Hangul của từng chữ Hán (để kiểm chứng Hanja AI trả về) ───────────────────────────────
const kHangul = loadKHangul(UNIHAN);

// ── Gọi Claude với structured output ────────────────────────────────────────────────────────────────
async function ask(schema, prompt) {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "medium", format: zodOutputFormat(schema) },
    messages: [{ role: "user", content: prompt }],
  });
  if (response.stop_reason === "refusal") throw new Error("Model từ chối yêu cầu.");
  if (!response.parsed_output) throw new Error(`Không có dữ liệu hợp lệ (stop_reason=${response.stop_reason}).`);
  return response.parsed_output;
}

async function pool(items, fn) {
  const out = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const walk = (words) => words.flatMap((w) => [w, ...walk(w.children ?? [])]);
const HAN = /\p{Script=Han}/u;

// ── Bước 1: tiếng Hàn ───────────────────────────────────────────────────────────────────────────────
const KoSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      hanja: z.string().describe("Hanja của CẢ từ, đúng 1 chữ Hán cho mỗi âm tiết Hangul, dạng phồn thể chuẩn Hàn. Chuỗi rỗng nếu là từ thuần Hàn / ngoại lai."),
      mnemonicVn: z.string().describe("Mẹo nhớ tiếng Việt 1-2 câu."),
    }),
  ),
});

function koPrompt(batch, retryNote = "") {
  return `Bạn giúp người Việt học tiếng Hàn qua âm Hán Việt. Với mỗi từ dưới đây:
- hanja: nếu là từ Hán-Hàn, ghi Hanja của CẢ từ (mỗi âm tiết Hangul đúng 1 chữ Hán, dạng phồn thể như trong từ điển Hàn). Từ thuần Hàn, ngoại lai, hoặc chỉ một phần là Hán-Hàn (vd có đuôi 하다) thì chỉ ghi Hanja cho đúng phần gốc Hán NẾU phần đó chiếm trọn các âm tiết — không chắc thì để chuỗi rỗng. Đừng đoán.
- mnemonicVn: mẹo nhớ 1-2 câu bằng tiếng Việt. Với từ Hán-Hàn, mở đầu bằng âm Hán Việt viết HOA kèm Hanja trong ngoặc, vd "MỘC TÀI (木材) — ...", rồi nối âm Hán Việt với nghĩa. Với từ thuần Hàn, dùng liên tưởng âm/hình ảnh dễ nhớ.
Trả về đúng các id đã cho.${retryNote}

${batch.map((w) => `- id=${w.id} | ${w.headword} | ${w.reading} | nghĩa: ${w.meaningVn}`).join("\n")}`;
}

const koPath = "data/ko.json";
const koData = JSON.parse(fs.readFileSync(koPath, "utf8"));
const koWords = koData.groups.flatMap((g) => g.roots.flatMap((r) => walk(r.words)));
const hasWordHanja = (w) => {
  if (w.hanja) return true;
  const syl = [...w.headword].filter((c) => /[가-힣]/.test(c)).length;
  return ((`${w.mnemonicVn ?? ""} ${w.meaningVn}`).match(/\p{Script=Han}+/gu) ?? []).some((h) => [...h].length === syl);
};
const koTodo = koWords.filter((w) => !w.mnemonicVn || !hasWordHanja(w)).slice(0, LIMIT);
console.log(`Tiếng Hàn: ${koTodo.length}/${koWords.length} từ cần làm (thiếu mẹo nhớ hoặc Hanja).`);

const koResults = new Map();
let rejected = 0;
await pool(chunk(koTodo, KO_BATCH), async (batch, bi) => {
  let pending = batch;
  for (let attempt = 0; attempt < 2 && pending.length; attempt++) {
    const note = attempt
      ? "\n\nLƯU Ý: lần trước Hanja của các từ này KHÔNG khớp âm Hangul từng âm tiết. Kiểm tra lại từng chữ; không chắc thì để rỗng."
      : "";
    const { items } = await ask(KoSchema, koPrompt(pending, note));
    const byId = new Map(items.map((it) => [it.id, it]));
    const retry = [];
    for (const w of pending) {
      const it = byId.get(w.id);
      if (!it) continue;
      const hanja = it.hanja.trim();
      if (!hanja || validHanja(kHangul, w.headword, hanja)) koResults.set(w.id, { hanja, mnemonicVn: it.mnemonicVn.trim() });
      else if (attempt === 0) retry.push(w);
      else {
        rejected++;
        // Hanja sai: chỉ giữ mẹo nhớ nếu nó không viện dẫn chữ Hán nào (tránh lan truyền Hanja sai)
        if (!HAN.test(it.mnemonicVn)) koResults.set(w.id, { hanja: "", mnemonicVn: it.mnemonicVn.trim() });
      }
    }
    pending = retry;
  }
  process.stdout.write(`  lô ${bi + 1} xong\n`);
});

let koHanjaAdded = 0;
let koMnemonicAdded = 0;
for (const w of koWords) {
  const r = koResults.get(w.id);
  if (!r) continue;
  if (r.hanja && !w.hanja) {
    w.hanja = r.hanja;
    koHanjaAdded++;
  }
  if (!w.mnemonicVn && r.mnemonicVn) {
    w.mnemonicVn = r.mnemonicVn;
    koMnemonicAdded++;
  }
}
if (DRY) {
  for (const w of koTodo.slice(0, 20)) {
    const r = koResults.get(w.id);
    console.log(`  ${w.headword} (${w.meaningVn}) → ${r ? `[${r.hanja || "thuần Hàn"}] ${r.mnemonicVn}` : "(bị loại)"}`);
  }
}
console.log(`Tiếng Hàn: +${koHanjaAdded} Hanja, +${koMnemonicAdded} mẹo nhớ, ${rejected} Hanja bị loại vì không khớp âm.`);
if (!DRY) fs.writeFileSync(koPath, JSON.stringify(koData, null, 2) + "\n");

// ── Bước 2: âm Hán Việt còn thiếu ───────────────────────────────────────────────────────────────────
const curated = new Map();
const dataFiles = fs.readdirSync("data").filter((f) => /^(zh|ja|ko)(-.*)?\.json$/.test(f));
const zhChars = new Set();
for (const f of dataFiles) {
  let d;
  try {
    d = JSON.parse(fs.readFileSync(path.join("data", f), "utf8"));
  } catch {
    continue;
  }
  for (const g of d.groups ?? []) {
    for (const r of g.roots ?? []) {
      if (r.hanViet && [...(r.character ?? "")].length === 1 && HAN.test(r.character) && !curated.has(r.character)) {
        curated.set(r.character, r.hanViet);
      }
      if (f.startsWith("zh")) for (const w of walk(r.words ?? [])) for (const c of w.headword ?? "") if (HAN.test(c)) zhChars.add(c);
    }
  }
  if (f.startsWith("zh")) for (const t of d.topics ?? []) for (const b of t.branches ?? []) for (const w of walk(b.words ?? [])) for (const c of w.headword ?? "") if (HAN.test(c)) zhChars.add(c);
}
for (const w of koWords) for (const c of w.hanja ?? "") zhChars.add(c);

const extraPath = "data/hanviet-extra.json";
const extra = fs.existsSync(extraPath) ? JSON.parse(fs.readFileSync(extraPath, "utf8")) : {};
const simplified = JSON.parse(fs.readFileSync("data/han-simplified.json", "utf8"));
const known = (c) => curated.has(c) || extra[c] || curated.has(simplified[c]);
const hvTodo = [...zhChars].filter((c) => !known(c)).slice(0, LIMIT === Infinity ? undefined : LIMIT * 3);
console.log(`Hán Việt: ${hvTodo.length} chữ còn thiếu âm.`);

const HvSchema = z.object({
  items: z.array(z.object({ char: z.string(), hanViet: z.string().describe("Âm Hán Việt chuẩn, 1 âm tiết, chữ thường, có dấu") })),
});
const VN_SYLLABLE = /^[a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]+$/;
let hvAdded = 0;
await pool(chunk(hvTodo, HV_BATCH), async (batch) => {
  const { items } = await ask(
    HvSchema,
    `Cho âm Hán Việt CHUẨN (âm đọc Hán Việt dùng trong từ điển Hán Việt, KHÔNG phải âm Nôm) của từng chữ Hán sau. Chữ giản thể thì đọc theo chữ phồn thể tương ứng. Chữ có nhiều âm thì chọn âm phổ biến nhất trong từ ghép hiện đại. Mỗi chữ đúng 1 âm tiết, viết thường, có dấu.\n\n${batch.join(" ")}`,
  );
  for (const it of items) {
    const hv = it.hanViet.trim().toLowerCase();
    if (batch.includes(it.char) && VN_SYLLABLE.test(hv)) {
      extra[it.char] = hv;
      hvAdded++;
    }
  }
});
console.log(`Hán Việt: +${hvAdded} chữ.`);
if (DRY) console.log("  mẫu:", hvTodo.slice(0, 30).map((c) => `${c}=${extra[c] ?? "?"}`).join(" "));
if (!DRY) {
  const sorted = Object.fromEntries(Object.entries(extra).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(extraPath, JSON.stringify(sorted, null, 0) + "\n");
}
if (DRY) console.log("(--dry: chưa ghi file)");
