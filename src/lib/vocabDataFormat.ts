import "server-only";
import type { LanguageData, VocabWord } from "@/types/vocab";

/** Ghi lại đúng quy ước định dạng thủ công đã dùng xuyên suốt data/*.json: thụt lề 2 dấu cách ở
 * mọi cấp, NHƯNG mỗi từ vựng (object có "headword") được viết gọn trên 1 dòng. Nếu dùng
 * JSON.stringify(data, null, 2) thông thường, toàn bộ mảng "words" sẽ bị nới dòng ra nhiều dòng,
 * tạo diff khổng lồ dù chỉ thêm vài từ — nên phải tự viết serializer khớp quy ước cũ. */

const EMPTY_IF_BLANK = new Set(["grammarPoint", "grammarExplanationVn"]);

function isWordLike(value: unknown): value is VocabWord {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "headword" in value &&
    "meaningVn" in value
  );
}

function cleanWordFields(word: VocabWord): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(word)) {
    if (v === undefined) continue;
    if (EMPTY_IF_BLANK.has(k) && v === "") continue;
    if (k === "children" && Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}

function stringifyWordCompact(fields: Record<string, unknown>): string {
  const parts = Object.entries(fields).map(([k, v]) => `"${k}": ${JSON.stringify(v)}`);
  return `{ ${parts.join(", ")} }`;
}

function stringifyWord(word: VocabWord, indent: number): string {
  const { children, ...rest } = word;
  const fields = cleanWordFields(rest as VocabWord);
  if (!children || children.length === 0) {
    return stringifyWordCompact(fields);
  }
  const pad = "  ".repeat(indent);
  const padIn = "  ".repeat(indent + 1);
  const fieldLines = Object.entries(fields).map(([k, v]) => `${padIn}"${k}": ${JSON.stringify(v)}`);
  fieldLines.push(`${padIn}"children": ${stringifyArray(children, indent + 1)}`);
  return `{\n${fieldLines.join(",\n")}\n${pad}}`;
}

function stringifyArray(arr: unknown[], indent: number): string {
  if (arr.length === 0) return "[]";
  const pad = "  ".repeat(indent);
  const padIn = "  ".repeat(indent + 1);
  const lines = arr.map((el) =>
    isWordLike(el) ? padIn + stringifyWord(el, indent + 1) : padIn + stringifyValue(el, indent + 1),
  );
  return `[\n${lines.join(",\n")}\n${pad}]`;
}

function stringifyValue(value: unknown, indent: number): string {
  if (Array.isArray(value)) return stringifyArray(value, indent);
  if (value && typeof value === "object") {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return "{}";
    const pad = "  ".repeat(indent);
    const padIn = "  ".repeat(indent + 1);
    const lines = entries.map(([k, v]) => `${padIn}"${k}": ${stringifyValue(v, indent + 1)}`);
    return `{\n${lines.join(",\n")}\n${pad}}`;
  }
  return JSON.stringify(value);
}

/** Vài file data/*.json được viết bằng quy ước "words gọn 1 dòng", số khác (vd. zh-shape.json)
 * lại dùng JSON.stringify thường (mỗi field 1 dòng) — tuỳ file được tạo/sửa lúc nào. Để giữ diff
 * tối thiểu khi ghi lại, phải nhận diện đúng quy ước của TỪNG file gốc rồi tái tạo lại đúng kiểu đó,
 * đồng thời giữ nguyên kiểu xuống dòng gốc (một số file cũ là CRLF, file mới là LF). */
export function formatLanguageDataLike(data: LanguageData, originalRaw: string): string {
  const usesCompactWords = /\{\s*"id":\s*"[^"]+",\s*"headword"/.test(originalRaw);
  const body = usesCompactWords ? stringifyValue(data, 0) + "\n" : JSON.stringify(data, null, 2) + "\n";
  return originalRaw.includes("\r\n") ? body.replace(/\n/g, "\r\n") : body;
}
