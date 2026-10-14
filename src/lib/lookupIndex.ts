import "server-only";
import type { Language, RootEntry, SoundGroup, VocabWord } from "@/types/vocab";
import {
  getFalseFriendLanguageData,
  getInitialLanguageData,
  getLanguageData,
  getShapeLanguageData,
} from "@/lib/vocabStore";
import { getTopicLanguageData } from "@/lib/topicStore";
import { flattenWords } from "@/lib/wordTree";
import hanVietExtra from "../../data/hanviet-extra.json";
import hanSimplified from "../../data/han-simplified.json";
import zhConnectors from "../../data/zh-connectors.json";
import koConnectors from "../../data/ko-connectors.json";
import type { ConnectorLanguageData } from "@/types/connector";

/** Tra nhanh toàn kho từ vựng của 1 ngôn ngữ: gõ chữ (检查 / 검사), cách đọc không dấu (jiancha /
 * geomsa), Hán Việt (kiểm tra) hay nghĩa tiếng Việt (có/không dấu) đều ra. Gom mọi trục (đồng âm, hình,
 * bẫy nghĩa, âm đầu, chủ đề) — cùng một từ ở nhiều trục gộp làm 1 kết quả kèm danh sách "xuất hiện ở".
 *
 * Kèm gợi ý nhớ dựng từ chính dữ liệu: tách Hán Việt từng chữ (bảng chữ→âm Hán Việt lấy từ mọi chữ gốc
 * có `hanViet` trong data/*), chữ cùng âm dễ nhầm, mẹo nhớ. */

export type LookupAxis = "sound" | "shape" | "false-friend" | "initial" | "topic" | "connector";

export interface HanVietPart {
  /** Chữ Hán (zh) hoặc Hanja (ko). */
  char: string;
  hv?: string;
  /** Âm tiết Hangul tương ứng (chỉ tiếng Hàn). */
  syllable?: string;
  /** Âm tiết thuần Hàn trong từ lai (vd 거리 trong 사거리) — `char` khi đó chính là âm tiết Hangul. */
  native?: boolean;
}

export interface LookupResult {
  id: string;
  language: Language;
  headword: string;
  reading: string;
  meaningVn: string;
  example: string;
  exampleVn: string;
  mnemonicVn?: string;
  level?: string;
  wordClass?: string;
  rootChar?: string;
  rootHanViet?: string;
  rootMeaning?: string;
  groupReading?: string;
  siblings: { character: string; meaningVn: string; hanViet?: string }[];
  /** Tách Hán Việt; `partial` = chỉ có âm tiết neo của nhóm (tiếng Hàn chưa rõ Hanja cả từ). */
  hanViet: { parts: HanVietPart[]; partial: boolean } | null;
  appearances: { axis: LookupAxis; label: string; href: string }[];
}

interface IndexEntry extends LookupResult {
  kHead: string;
  kRead: string;
  kHv: string;
  kMean: string;
}

const HAN = /\p{Script=Han}/u;
const HANGUL = /[가-힣]/;

/** Bỏ dấu (pinyin, tiếng Việt), đ→d, chữ thường — CHỈ bỏ dấu kết hợp Latinh rồi NFC lại, để không băm
 * nát âm tiết Hangul (NFD tách Hangul thành jamo). */
export function fold(s: string | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .normalize("NFC")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[0-9]/g, "")
    .replace(/[^\p{L}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const noSpace = (s: string) => s.replace(/\s+/g, "");

/** Phồn thể → giản thể (Unihan), và chiều ngược lại — để 學 (Hanja) và 学 (Trung) là cùng một chữ. */
const TO_SIMPLIFIED = hanSimplified as Record<string, string>;
const TO_TRADITIONAL: Record<string, string> = {};
for (const [trad, simp] of Object.entries(TO_SIMPLIFIED)) TO_TRADITIONAL[simp] ??= trad;

/** Khoá chung của 1 chữ bất kể giản/phồn thể — dùng để gom họ chữ giữa tiếng Trung và Hanja tiếng Hàn. */
export function canonicalChar(c: string): string {
  return TO_SIMPLIFIED[c] ?? c;
}

/** Bảng chữ Hán → âm Hán Việt: chữ gốc có `hanViet` soạn tay (Trung / Nhật / Hàn, mọi trục) là chính,
 * data/hanviet-extra.json (AI điền chỗ còn thiếu) bù vào; tra được cả qua dạng giản ↔ phồn thể. */
let hvMapPromise: Promise<Map<string, string>> | null = null;
/** Nghĩa tiếng Việt của chữ (lấy từ chữ gốc soạn tay) — hiện ở đầu trang họ chữ. */
const charMeaning = new Map<string, string>();

export function charMeaningVn(c: string): string | undefined {
  return charMeaning.get(c) ?? charMeaning.get(canonicalChar(c)) ?? charMeaning.get(TO_TRADITIONAL[c] ?? "");
}

export async function getHanVietMap(): Promise<Map<string, string>> {
  if (!hvMapPromise) {
    hvMapPromise = (async () => {
      const map = new Map<string, string>();
      const langs: Language[] = ["zh", "ja", "ko"];
      const sets = await Promise.all(
        langs.flatMap((l) => [getLanguageData(l), getShapeLanguageData(l), getFalseFriendLanguageData(l), getInitialLanguageData(l)]),
      );
      for (const data of sets) {
        for (const g of data?.groups ?? []) {
          for (const r of g.roots) {
            const c = r.character?.trim();
            if (c && Array.from(c).length === 1 && HAN.test(c) && r.hanViet && !map.has(c)) {
              map.set(c, r.hanViet.split(/[,/;(]/)[0].trim().toLowerCase());
              if (r.meaningVn && !charMeaning.has(c)) charMeaning.set(c, r.meaningVn);
            }
          }
        }
      }
      for (const [c, hv] of Object.entries(hanVietExtra as Record<string, string>)) if (!map.has(c)) map.set(c, hv);
      // Giản ↔ phồn thể dùng chung âm: 学 thiếu thì mượn 學 và ngược lại
      for (const [trad, simp] of Object.entries(TO_SIMPLIFIED)) {
        const hv = map.get(trad) ?? map.get(simp);
        if (hv) {
          if (!map.has(trad)) map.set(trad, hv);
          if (!map.has(simp)) map.set(simp, hv);
        }
      }
      return map;
    })();
  }
  return hvMapPromise;
}

/** Âm tiết neo của nhóm tiếng Hàn: reading kiểu "목 (mok)" → "목". */
function anchorSyllable(groupReading?: string): string | undefined {
  return groupReading?.match(/[가-힣]+/)?.[0];
}

export function buildHanViet(
  lang: Language,
  word: Pick<VocabWord, "headword" | "meaningVn" | "mnemonicVn" | "hanja">,
  root: Pick<RootEntry, "character" | "hanViet"> | undefined,
  groupReading: string | undefined,
  hvMap: Map<string, string>,
): LookupResult["hanViet"] {
  if (lang === "zh" || lang === "ja") {
    const chars = Array.from(word.headword).filter((c) => HAN.test(c));
    if (chars.length === 0) return null;
    const parts = chars.map((c) => ({ char: c, hv: hvMap.get(c) }));
    return parts.some((p) => p.hv) ? { parts, partial: false } : null;
  }
  if (lang === "ko") {
    const syllables = Array.from(word.headword).filter((c) => HANGUL.test(c));
    // Hanja cả từ: trường `hanja` (đã kiểm chứng âm) nếu có, không thì tìm trong mẹo nhớ / nghĩa, vd
    // "MỘC TÀI (木材)" — chuỗi Hán đúng số âm tiết
    const text = `${word.mnemonicVn ?? ""} ${word.meaningVn}`;
    const hanja =
      (word.hanja && Array.from(word.hanja).length === syllables.length ? word.hanja : undefined) ??
      (text.match(/\p{Script=Han}+/gu) ?? []).find((h) => Array.from(h).length === syllables.length);
    if (hanja && syllables.length > 0) {
      const chars = Array.from(hanja);
      return {
        parts: chars.map((c, i) =>
          c === "_"
            ? { char: syllables[i], syllable: syllables[i], native: true }
            : { char: c, hv: hvMap.get(c), syllable: syllables[i] },
        ),
        partial: false,
      };
    }
    // Không rõ Hanja cả từ → ít nhất chỉ ra âm tiết neo của nhóm = chữ gốc
    const anchor = anchorSyllable(groupReading);
    if (root?.character && HAN.test(root.character) && anchor && word.headword.includes(anchor)) {
      return {
        parts: [{ char: root.character, hv: root.hanViet?.toLowerCase() ?? hvMap.get(root.character), syllable: anchor }],
        partial: true,
      };
    }
  }
  return null;
}

const AXIS_LABEL: Record<Exclude<LookupAxis, "topic" | "connector">, string> = {
  sound: "Đồng âm",
  shape: "Hình gần giống",
  "false-friend": "Bẫy nghĩa",
  initial: "Cùng âm đầu",
};

function groupHref(axis: Exclude<LookupAxis, "topic" | "connector">, lang: Language, groupId: string): string {
  const base = axis === "sound" ? "" : axis === "shape" ? "/shapes" : axis === "false-friend" ? "/false-friends" : "/initials";
  return `${base}/${lang}/${groupId}`;
}

async function buildIndexUncached(lang: Language): Promise<IndexEntry[]> {
  const hvMap = await getHanVietMap();
  const [main, shape, falseFriend, initial] = await Promise.all([
    getLanguageData(lang),
    getShapeLanguageData(lang),
    getFalseFriendLanguageData(lang),
    getInitialLanguageData(lang),
  ]);
  const byHeadword = new Map<string, IndexEntry>();

  function add(
    word: VocabWord,
    appearance: LookupResult["appearances"][number],
    ctx: { root?: RootEntry; group?: SoundGroup },
  ) {
    const key = word.headword.trim();
    if (!key) return;
    const existing = byHeadword.get(key);
    if (existing) {
      if (!existing.appearances.some((a) => a.href === appearance.href)) existing.appearances.push(appearance);
      // Bản ở trục đồng âm thường đủ thông tin nhất; các trục sau chỉ bù chỗ còn trống
      existing.mnemonicVn ??= word.mnemonicVn;
      existing.level ??= word.level;
      if (!existing.example && word.example) {
        existing.example = word.example;
        existing.exampleVn = word.exampleVn;
      }
      return;
    }
    const { root, group } = ctx;
    const hanViet = buildHanViet(lang, word, root, group?.reading, hvMap);
    byHeadword.set(key, {
      id: word.id,
      language: lang,
      headword: key,
      // Dữ liệu cũ đôi khi thiếu reading/meaning — chỉ mục không được vỡ vì 1 từ thiếu trường
      reading: word.reading ?? "",
      meaningVn: word.meaningVn ?? "",
      example: word.example ?? "",
      exampleVn: word.exampleVn ?? "",
      mnemonicVn: word.mnemonicVn,
      level: word.level,
      wordClass: word.wordClass,
      rootChar: root?.character,
      rootHanViet: root?.hanViet,
      rootMeaning: root?.meaningVn,
      groupReading: group?.reading,
      siblings: group
        ? group.roots
            .filter((r) => r.id !== root?.id)
            .map((r) => ({ character: r.character, meaningVn: r.meaningVn, hanViet: r.hanViet }))
        : [],
      hanViet,
      appearances: [appearance],
      kHead: key.toLowerCase(),
      kRead: noSpace(fold(word.reading)),
      kHv: noSpace(fold(hanViet?.parts.filter((p) => !p.native).map((p) => p.hv ?? "").join("") ?? "")),
      kMean: fold(word.meaningVn),
    });
  }

  const axes: [Exclude<LookupAxis, "topic" | "connector">, typeof main][] = [
    ["sound", main],
    ["shape", shape],
    ["false-friend", falseFriend],
    ["initial", initial],
  ];
  for (const [axis, data] of axes) {
    for (const group of data?.groups ?? []) {
      const appearance = { axis, label: `${AXIS_LABEL[axis]} · ${group.reading}`, href: groupHref(axis, lang, group.id) };
      for (const root of group.roots) {
        for (const word of flattenWords(root.words)) add(word, appearance, { root, group });
      }
    }
  }
  for (const topic of getTopicLanguageData(lang)?.topics ?? []) {
    const appearance = { axis: "topic" as const, label: `Chủ đề · ${topic.titleVn}`, href: `/topics/${lang}/mindmap/${topic.id}` };
    for (const branch of topic.branches) {
      for (const word of flattenWords(branch.words)) add(word, appearance, {});
    }
  }
  // Từ nối (和, 그래서…) — tra "vì vậy", "hoặc" cũng ra; gắn link tới mục 🔗 Từ nối
  const connectors = lang === "zh" ? (zhConnectors as ConnectorLanguageData) : lang === "ko" ? (koConnectors as ConnectorLanguageData) : null;
  for (const category of connectors?.categories ?? []) {
    for (const c of category.entries) {
      const appearance = { axis: "connector" as const, label: `Từ nối · ${category.titleVn.split(" — ")[0]}`, href: `/tu-noi?lang=${lang}&id=${c.id}` };
      // "虽然…但是…" / "만약(에) … -(으)면" → lấy dạng chính "虽然" / "만약" làm chữ tra
      const headword = c.form.split(" / ")[0].split("…")[0].replace(/\(.*?\)/g, "").trim() || c.form;
      add(
        {
          id: `conn:${c.id}`,
          headword,
          reading: c.reading,
          meaningVn: c.meaningVn,
          example: c.examples[0]?.sentence ?? "",
          exampleVn: c.examples[0]?.translationVn ?? "",
          mnemonicVn: c.mnemonicVn,
          hanja: c.hanja,
        } as VocabWord,
        appearance,
        {},
      );
    }
  }
  return [...byHeadword.values()];
}

// Cache theo ngôn ngữ, làm mới sau vài phút để từ người học vừa thêm bằng AI cũng tra ra được.
const CACHE_MS = 5 * 60 * 1000;
const cache = new Map<Language, { at: number; entries: Promise<IndexEntry[]> }>();

function getIndex(lang: Language): Promise<IndexEntry[]> {
  const hit = cache.get(lang);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.entries;
  const entries = buildIndexUncached(lang);
  cache.set(lang, { at: Date.now(), entries });
  entries.catch(() => cache.delete(lang));
  return entries;
}

function score(e: IndexEntry, q: { raw: string; lower: string; fold: string; foldNoSpace: string; native: boolean }): number {
  if (q.native) {
    if (e.kHead === q.lower) return 100;
    if (e.kHead.startsWith(q.lower)) return 80;
    if (e.kHead.includes(q.lower)) return 60;
    // Chỉ chữ Hán thật (tra bằng Hanja/chữ Hán) — âm tiết thuần Hàn như 하/다 khớp gần như mọi từ
    if (e.hanViet?.parts.some((p) => !p.native && q.raw.includes(p.char))) return 40;
    if (e.rootChar && q.raw.includes(e.rootChar)) return 30;
    return 0;
  }
  let s = 0;
  if (e.kRead && e.kRead === q.foldNoSpace) s = Math.max(s, 95);
  else if (e.kRead.startsWith(q.foldNoSpace) && q.foldNoSpace.length >= 2) s = Math.max(s, 70);
  if (e.kHv && e.kHv === q.foldNoSpace) s = Math.max(s, 90);
  else if (e.kHv.startsWith(q.foldNoSpace) && q.foldNoSpace.length >= 3) s = Math.max(s, 62);
  // Gõ đúng âm Hán Việt của 1 chữ (vd "mộc") → các từ chứa chữ đó; chữ đứng đầu từ xếp trước
  const hvParts = e.hanViet?.parts.map((p) => noSpace(fold(p.hv))) ?? [];
  const partIdx = hvParts.indexOf(q.foldNoSpace);
  if (partIdx === 0) s = Math.max(s, 80);
  else if (partIdx > 0) s = Math.max(s, 72);
  const mean = ` ${e.kMean} `;
  if (e.kMean === q.fold) s = Math.max(s, 88);
  else if (mean.includes(` ${q.fold} `)) s = Math.max(s, 75);
  else if (q.fold.length >= 3 && e.kMean.includes(q.fold)) s = Math.max(s, 45);
  // Gõ đúng dấu tiếng Việt thì ưu tiên hơn kết quả chỉ khớp khi bỏ dấu
  if (s > 0 && (e.meaningVn.toLowerCase().includes(q.lower) || e.hanViet?.parts.some((p) => p.hv === q.lower))) s += 5;
  return s;
}

function toResult(e: IndexEntry): LookupResult {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { kHead, kRead, kHv, kMean, ...result } = e;
  return result;
}

export interface FamilyResult {
  char: string;
  /** Các dạng viết của cùng chữ (giản thể / phồn thể), vd ["学", "學"]. */
  forms: string[];
  hanViet?: string;
  meaningVn?: string;
  zh: LookupResult[];
  ko: LookupResult[];
  zhTotal: number;
  koTotal: number;
}

/** "Họ chữ": mọi từ tiếng Trung chứa chữ `char` và mọi từ tiếng Hàn có Hanja chứa chữ đó (giản/phồn thể coi
 * như một). Nhớ 1 chữ = mở ra cả họ từ ở hai ngôn ngữ, vd 学 (học) → 学习, 学生… và 학생, 학교… */
export async function lookupFamily(char: string, limit = 40): Promise<FamilyResult> {
  const key = canonicalChar(char);
  const [zhIndex, koIndex, hvMap] = await Promise.all([getIndex("zh"), getIndex("ko"), getHanVietMap()]);
  // Từ BẮT ĐẦU bằng chữ này lên trước (学生 trước 同学, 학원 學院 trước 수학 數學), rồi từ ngắn trước
  const startsWithKey = (e: IndexEntry) => {
    const firstPart = e.hanViet?.parts[0];
    const first = firstPart && !firstPart.native ? firstPart.char : Array.from(e.headword)[0] ?? "";
    return canonicalChar(first) === key;
  };
  const byLength = (a: IndexEntry, b: IndexEntry) =>
    Number(startsWithKey(b)) - Number(startsWithKey(a)) || a.headword.length - b.headword.length;
  const zh = zhIndex
    .filter((e) => Array.from(e.headword).some((c) => HAN.test(c) && canonicalChar(c) === key))
    .sort(byLength);
  const ko = koIndex
    .filter((e) => e.hanViet?.parts.some((p) => !p.native && canonicalChar(p.char) === key))
    .sort(byLength);
  const forms = [...new Set([char, key, TO_TRADITIONAL[key]].filter((c): c is string => !!c))];
  return {
    char,
    forms,
    hanViet: hvMap.get(char) ?? hvMap.get(key),
    meaningVn: charMeaningVn(char),
    zh: zh.slice(0, limit).map(toResult),
    ko: ko.slice(0, limit).map(toResult),
    zhTotal: zh.length,
    koTotal: ko.length,
  };
}

/** Lấy đủ thông tin các từ theo đúng chữ (dùng cho lịch sử tra / ôn từ đã tra); giữ thứ tự đầu vào. */
export async function getByHeadwords(lang: Language, headwords: string[]): Promise<LookupResult[]> {
  const index = await getIndex(lang);
  const byHead = new Map(index.map((e) => [e.headword, e]));
  return headwords.flatMap((h) => {
    const e = byHead.get(h);
    return e ? [toResult(e)] : [];
  });
}

export async function lookup(
  lang: Language,
  query: string,
  limit = 20,
): Promise<{ results: LookupResult[]; total: number }> {
  const raw = query.trim();
  if (!raw) return { results: [], total: 0 };
  const index = await getIndex(lang);
  const f = fold(raw);
  const q = {
    raw,
    lower: raw.toLowerCase(),
    fold: f,
    foldNoSpace: noSpace(f),
    native: HAN.test(raw) || HANGUL.test(raw),
  };
  if (!q.native && !q.foldNoSpace) return { results: [], total: 0 };

  const scored = index
    .map((e) => ({ e, s: score(e, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.e.headword.length - b.e.headword.length);

  const results = scored.slice(0, limit).map(({ e }) => toResult(e));
  return { results, total: scored.length };
}
