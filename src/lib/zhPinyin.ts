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
