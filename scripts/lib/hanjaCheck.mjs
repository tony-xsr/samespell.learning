/** Kiểm chứng Hanja của 1 từ tiếng Hàn bằng Unihan kHangul: chữ thứ i phải đọc đúng âm tiết thứ i. */
import fs from "node:fs";
import path from "node:path";

export function loadKHangul(unihanDir) {
  const map = new Map();
  for (const line of fs.readFileSync(path.join(unihanDir, "Unihan_Readings.txt"), "utf8").split("\n")) {
    if (!line.includes("\tkHangul\t")) continue;
    const [code, , value] = line.split("\t");
    map.set(String.fromCodePoint(parseInt(code.slice(2), 16)), value.split(" ").map((v) => v.split(":")[0]));
  }
  return map;
}

const decompose = (s) => {
  const n = s.charCodeAt(0) - 0xac00;
  return { l: Math.floor(n / 588), v: Math.floor((n % 588) / 28), t: n % 28 };
};

/** Khớp âm tiết, cho phép luật đầu âm 두음법칙 ở âm tiết đầu từ: ㄹ→ㄴ/ㅇ, ㄴ→ㅇ (ㄴ=2, ㄹ=5, ㅇ=11). */
function syllableMatches(actual, reading, isFirst, isLast) {
  if (actual === reading) return true;
  const a = decompose(actual);
  const r = decompose(reading);
  // 사이시옷: phụ âm đệm ㅅ (patchim chỉ số 19) chen vào âm tiết không cuối, vd 숫자 數字, 횟수 回數
  if (!isLast && a.l === r.l && a.v === r.v && a.t === 19 && r.t === 0) return true;
  if (a.v !== r.v || a.t !== r.t) return false;
  // ㄹ → ㅇ giữa từ: 률/렬 sau nguyên âm hoặc ㄴ (자율 自律, 비율 比率), và vài từ như 실연 失戀
  if (!isFirst) return r.l === 5 && a.l === 11;
  return (r.l === 5 && (a.l === 2 || a.l === 11)) || (r.l === 2 && a.l === 11);
}

/** `hanja` có đúng 1 ký tự cho mỗi âm tiết Hangul; "_" = âm tiết thuần Hàn (vd 사거리 → "四__"), phải có ít
 * nhất 1 chữ Hán. Mỗi chữ Hán phải đọc đúng âm tiết ở vị trí của nó. */
export function validHanja(kHangul, headword, hanja) {
  const syllables = [...headword].filter((c) => /[\uac00-\ud7a3]/.test(c));
  const chars = [...hanja];
  if (chars.length === 0 || chars.length !== syllables.length || chars.every((c) => c === "_")) return false;
  return chars.every(
    (c, i) =>
      c === "_" ||
      (kHangul.get(c) ?? []).some((r) => syllableMatches(syllables[i], r, i === 0, i === chars.length - 1)),
  );
}
