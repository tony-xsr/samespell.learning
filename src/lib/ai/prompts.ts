import type { Language } from "@/types/vocab";
import {
  EXPAND_ROOT_JSON_SHAPE_HINT,
  NEW_ROOT_JSON_SHAPE_HINT,
  MNEMONIC_JSON_SHAPE_HINT,
} from "@/lib/ai/schemas";

export const LANG_NAMES: Record<Language, string> = {
  zh: "tiếng Trung (Quan Thoại, ghi pinyin)",
  ko: "tiếng Hàn (ghi romanization kiểu Revised Romanization)",
  ja: "tiếng Nhật (ghi romaji)",
};

export function buildExpandRootPrompt(params: {
  language: Language;
  character: string;
  hanViet?: string;
  meaningVn: string;
  existingHeadwords: string[];
  count: number;
}): string {
  const langName = LANG_NAMES[params.language];
  return `Bạn là trợ lý dạy từ vựng ${langName} cho người Việt.
Chữ gốc: "${params.character}" (âm Hán Việt: ${params.hanViet ?? "không rõ"}), nghĩa cốt lõi: ${params.meaningVn}.
Hãy sinh ra ${params.count} từ vựng THỰC TẾ, thông dụng có chứa chữ "${params.character}" ở đầu hoặc cuối từ, phù hợp trình độ sơ-trung cấp.
KHÔNG được trùng với các từ đã có: ${params.existingHeadwords.join(", ") || "(chưa có)"}.
Mỗi từ cần: từ vựng gốc, phiên âm, nghĩa tiếng Việt ngắn gọn, một câu ví dụ tự nhiên và bản dịch tiếng Việt của câu ví dụ.
${EXPAND_ROOT_JSON_SHAPE_HINT}`;
}

export function buildNewRootPrompt(params: {
  language: Language;
  groupReading: string;
  existingCharacters: string[];
}): string {
  const langName = LANG_NAMES[params.language];
  return `Bạn là trợ lý dạy từ vựng ${langName} cho người Việt, chuyên về hiện tượng đồng âm dị nghĩa (nhiều chữ Hán khác nhau đọc giống nhau nhưng nghĩa khác nhau).
Nhóm âm hiện tại đang đọc là: "${params.groupReading}".
Các chữ đã có trong nhóm này rồi (KHÔNG được lặp lại): ${params.existingCharacters.join(", ") || "(chưa có)"}.
Hãy tìm THÊM MỘT chữ Hán/Hanja khác, có cách đọc giống hệt hoặc gần giống "${params.groupReading}" trong ${langName}, nhưng mang nghĩa hoàn toàn khác các chữ đã có.
Sau đó sinh 4 từ vựng thông dụng chứa chữ đó, kèm phiên âm, nghĩa tiếng Việt, và câu ví dụ có bản dịch.
${NEW_ROOT_JSON_SHAPE_HINT}`;
}

export function buildExpandWordPrompt(params: {
  language: Language;
  headword: string;
  reading: string;
  meaningVn: string;
  existingChildHeadwords: string[];
}): string {
  const langName = LANG_NAMES[params.language];
  return `Bạn là trợ lý dạy từ vựng ${langName} cho người Việt.
Từ trung tâm: "${params.headword}" (đọc là "${params.reading}"), nghĩa: ${params.meaningVn}.
Hãy sinh ra 3-4 từ vựng LIÊN QUAN đến từ này để mở rộng thêm một nhánh mindmap từ chính từ này —
có thể là từ đồng nghĩa, gần nghĩa, trái nghĩa, cùng chủ đề, hoặc từ ghép mở rộng từ từ trung tâm.
Mục tiêu là giúp người học mở rộng vốn từ xung quanh từ "${params.headword}".
KHÔNG được trùng với các từ đã có: ${params.existingChildHeadwords.join(", ") || "(chưa có)"}.
Mỗi từ cần: từ vựng gốc, phiên âm, nghĩa tiếng Việt ngắn gọn, một câu ví dụ tự nhiên và bản dịch tiếng Việt của câu ví dụ.
${EXPAND_ROOT_JSON_SHAPE_HINT}`;
}

export function buildMnemonicPrompt(params: {
  language: Language;
  headword: string;
  reading: string;
  meaningVn: string;
}): string {
  const langName = LANG_NAMES[params.language];
  return `Bạn là trợ lý dạy từ vựng ${langName} cho người Việt.
Từ: "${params.headword}" (đọc là "${params.reading}"), nghĩa: ${params.meaningVn}.
Hãy nghĩ ra MỘT mẹo nhớ ngắn gọn (1-2 câu) bằng tiếng Việt giúp người học nhớ từ này — có thể dựa vào
âm đọc nghe giống từ/âm tiếng Việt nào, hoặc liên tưởng hình ảnh gắn với nghĩa của từ. Viết tự nhiên,
dí dỏm, dễ nhớ, không giải thích dài dòng.
${MNEMONIC_JSON_SHAPE_HINT}`;
}
