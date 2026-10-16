#!/usr/bin/env node
/**
 * Gộp chú thích Hanja + mẹo nhớ soạn sẵn (TSV) vào các file từ vựng tiếng Hàn (ko.json, ko-false-friends.json,
 * ko-shape.json — tìm theo id), CÓ KIỂM CHỨNG.
 *
 *   node scripts/merge-ko-annotations.mjs --unihan <thư mục Unihan> <file.tsv> [...]
 *
 * Mỗi dòng TSV: id <TAB> hanja <TAB> mẹo nhớ. hanja: 1 ký tự / âm tiết Hangul, "_" = âm tiết thuần Hàn,
 * để trống nếu từ thuần Hàn hoàn toàn. Hanja không đọc đúng âm (Unihan kHangul) thì KHÔNG ghi — in ra để sửa.
 * Mẹo nhớ chỉ điền vào từ chưa có (không đè mẹo soạn tay có sẵn).
 */
import fs from "node:fs";
import { loadKHangul, validHanja } from "./lib/hanjaCheck.mjs";

const args = process.argv.slice(2);
const ui = args.indexOf("--unihan");
if (ui < 0) {
  console.error("Thiếu --unihan <thư mục>");
  process.exit(1);
}
const kHangul = loadKHangul(args[ui + 1]);
const files = args.filter((_, i) => i !== ui && i !== ui + 1);

// Mọi file tiếng Hàn có từ vựng dạng groups → roots → words; id từ vựng là duy nhất giữa các file.
const KO_FILES = ["data/ko.json", "data/ko-false-friends.json", "data/ko-shape.json"];
const walk = (ws) => ws.flatMap((w) => [w, ...walk(w.children ?? [])]);
const docs = KO_FILES.map((path) => ({ path, data: JSON.parse(fs.readFileSync(path, "utf8")), dirty: false }));
const byId = new Map();
for (const doc of docs) {
  for (const w of doc.data.groups.flatMap((g) => g.roots.flatMap((r) => walk(r.words)))) byId.set(w.id, { w, doc });
}

let hanjaAdded = 0;
let mnemonicAdded = 0;
const rejected = [];
const unknown = [];
for (const file of files) {
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    const [id, hanja = "", mnemonic = ""] = line.split("\t").map((s) => s.trim());
    const hit = byId.get(id);
    if (!hit) {
      unknown.push(id);
      continue;
    }
    const { w, doc } = hit;
    if (hanja) {
      if (validHanja(kHangul, w.headword, hanja)) {
        if (w.hanja !== hanja) {
          hanjaAdded++;
          doc.dirty = true;
        }
        w.hanja = hanja;
      } else rejected.push(`${w.headword} = ${hanja}`);
    }
    if (mnemonic && !w.mnemonicVn) {
      w.mnemonicVn = mnemonic;
      mnemonicAdded++;
      doc.dirty = true;
    }
  }
}
for (const doc of docs) if (doc.dirty) fs.writeFileSync(doc.path, JSON.stringify(doc.data, null, 2) + "\n");

// ko-topics.json trộn 2 kiểu định dạng (từ viết 1 dòng / nhiều dòng) nên KHÔNG ghi lại cả file — chèn thẳng
// trường mới vào cuối object của từng từ, giữ nguyên định dạng gốc (diff chỉ gồm phần thêm).
const TOPICS_PATH = "data/ko-topics.json";
let topicsRaw = fs.readFileSync(TOPICS_PATH, "utf8");
const topicsData = JSON.parse(topicsRaw);
const topicWords = new Map(
  topicsData.topics.flatMap((t) => t.branches.flatMap((b) => walk(b.words))).map((w) => [w.id, w]),
);
let topicsChanged = 0;

/** Vị trí dấu "}" đóng object chứa `"id": "<id>"` (bỏ qua ngoặc nằm trong chuỗi). */
function objectBounds(raw, id) {
  const at = raw.indexOf(`"id": "${id}"`);
  if (at < 0) return null;
  const start = raw.lastIndexOf("{", at);
  let depth = 0;
  let inStr = false;
  for (let i = start; i < raw.length; i++) {
    const c = raw[i];
    if (inStr) {
      if (c === "\\") i++;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return { start, end: i, idAt: at };
  }
  return null;
}

function patchTopicWord(id, fields) {
  const b = objectBounds(topicsRaw, id);
  if (!b) return false;
  const body = topicsRaw.slice(b.start, b.end);
  let last = b.end - 1;
  while (/\s/.test(topicsRaw[last])) last--;
  let insert;
  if (!body.includes("\n")) {
    insert = Object.entries(fields).map(([k, v]) => `, ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join("");
  } else {
    const lineStart = topicsRaw.lastIndexOf("\n", b.idAt) + 1;
    const indent = topicsRaw.slice(lineStart, b.idAt);
    insert = Object.entries(fields).map(([k, v]) => `,\n${indent}${JSON.stringify(k)}: ${JSON.stringify(v)}`).join("");
  }
  topicsRaw = topicsRaw.slice(0, last + 1) + insert + topicsRaw.slice(last + 1);
  return true;
}

for (const file of files) {
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    const [id, hanja = "", mnemonic = ""] = line.split("\t").map((s) => s.trim());
    const w = topicWords.get(id);
    if (!w) continue;
    const fields = {};
    if (hanja && !w.hanja) {
      if (validHanja(kHangul, w.headword, hanja)) fields.hanja = hanja;
      else rejected.push(`${w.headword} = ${hanja}`);
    }
    if (mnemonic && !w.mnemonicVn) fields.mnemonicVn = mnemonic;
    if (Object.keys(fields).length && patchTopicWord(id, fields)) {
      topicsChanged++;
      if (fields.hanja) hanjaAdded++;
      if (fields.mnemonicVn) mnemonicAdded++;
      unknown.splice(unknown.indexOf(id), 1);
    }
  }
}
if (topicsChanged) {
  JSON.parse(topicsRaw); // chèn hỏng thì dừng ở đây, không ghi file lỗi
  fs.writeFileSync(TOPICS_PATH, topicsRaw);
}
console.log(`+${hanjaAdded} Hanja, +${mnemonicAdded} mẹo nhớ.`);
if (rejected.length) console.log(`Hanja bị loại (${rejected.length}): ${rejected.join(" · ")}`);
if (unknown.length) console.log(`id không tồn tại: ${unknown.join(", ")}`);
