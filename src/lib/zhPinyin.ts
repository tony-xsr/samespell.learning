import { pinyin } from "pinyin-pro";

/** Sinh pinyin có dấu thanh cho 1 câu tiếng Trung bất kỳ (dùng để hiện pinyin cho câu ví dụ —
 * dữ liệu tĩnh chỉ lưu pinyin của TỪ, không lưu pinyin của cả câu ví dụ). Chỉ dùng cho tiếng
 * Trung; tiếng Hàn (Hangul đã là chữ ghi âm) và tiếng Nhật (cần từ điển furigana riêng, phức tạp
 * hơn nhiều) không áp dụng hàm này. */
export function toPinyin(text: string): string {
  try {
    return pinyin(text, { toneType: "symbol", type: "string" });
  } catch {
    return "";
  }
}

/** Bảng nguyên âm có dấu thanh → [nguyên âm gốc, số thanh] — dùng để so sánh 2 chuỗi pinyin
 * "cùng 1 âm" bất kể AI viết theo kiểu dấu thanh ("fēng") hay số thanh ("feng1"), xem
 * pinyinToneKey() bên dưới. `pinyin-pro`'s `convert()` chỉ đổi được chiều số→dấu, không có chiều
 * ngược lại, nên phải tự lập bảng này. */
const TONE_MARK_TO_BASE: Record<string, [string, string]> = {
  ā: ["a", "1"], á: ["a", "2"], ǎ: ["a", "3"], à: ["a", "4"],
  ē: ["e", "1"], é: ["e", "2"], ě: ["e", "3"], è: ["e", "4"],
  ī: ["i", "1"], í: ["i", "2"], ǐ: ["i", "3"], ì: ["i", "4"],
  ō: ["o", "1"], ó: ["o", "2"], ǒ: ["o", "3"], ò: ["o", "4"],
  ū: ["u", "1"], ú: ["u", "2"], ǔ: ["u", "3"], ù: ["u", "4"],
  ǖ: ["v", "1"], ǘ: ["v", "2"], ǚ: ["v", "3"], ǜ: ["v", "4"],
  ü: ["v", "0"],
};

/** Chuẩn hoá 1 chuỗi pinyin thành khoá so sánh KHÔNG phụ thuộc cách ghi thanh điệu (dấu thanh hay
 * số thanh) — vd "fēng", "feng1", "FENG1" đều ra cùng 1 khoá. Dùng để phát hiện 2 lần gọi AI độc
 * lập có thực sự "cùng 1 âm" hay không trước khi gộp/tách nhóm đồng âm (xem findGroupByReading),
 * vì schema hiện không ép AI trả về pinyin theo đúng 1 kiểu ghi cố định. Giữ nguyên số thanh (khác
 * thanh vẫn là khác âm, đúng triết lý "nhóm đồng âm" của app) — chỉ gộp 2 CÁCH GHI của CÙNG 1 âm. */
export function pinyinToneKey(reading: string): string {
  const normalized = reading.trim().normalize("NFC").toLowerCase();
  let letters = "";
  let tones = "";
  for (const ch of normalized) {
    const mapped = TONE_MARK_TO_BASE[ch];
    if (mapped) {
      letters += mapped[0];
      tones += mapped[1];
    } else if (/[a-z]/.test(ch)) {
      letters += ch;
    } else if (/[0-9]/.test(ch)) {
      tones += ch;
    }
    // bỏ qua khoảng trắng, dấu nháy đơn (ngăn âm tiết, vd "fēng'ér") và ký tự khác.
  }
  return `${letters}#${tones}`;
}
