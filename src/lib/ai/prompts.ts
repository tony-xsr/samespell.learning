import type { Language } from "@/types/vocab";
import {
  EXPAND_ROOT_JSON_SHAPE_HINT,
  NEW_ROOT_JSON_SHAPE_HINT,
  MNEMONIC_JSON_SHAPE_HINT,
  GRAMMAR_EXAMPLE_JSON_SHAPE_HINT,
} from "@/lib/ai/schemas";

export const LANG_NAMES: Record<Language, string> = {
  zh: "tiếng Trung (Quan Thoại, ghi pinyin)",
  ko: "tiếng Hàn (ghi romanization kiểu Revised Romanization)",
  ja: "tiếng Nhật (ghi romaji)",
};

const POLYPHONY_INSTRUCTION = `Lưu ý về chữ ĐA ÂM: nếu chữ gốc có nhiều cách đọc/âm Hán Việt khác nhau tùy theo nghĩa hoặc từ ghép (ví dụ 行 đọc "hàng" trong 银行 ngân hàng nhưng đọc "hành" trong 旅行 lữ hành; 看 đọc "khan" trong 看守 nhưng đọc "khán" trong 看书), hãy ƯU TIÊN chọn các từ minh hoạ được CÀNG NHIỀU cách đọc/nghĩa khác nhau của chữ gốc càng tốt (thay vì nhiều từ chỉ lặp lại 1 cách đọc). Mỗi từ phải ghi ĐÚNG phiên âm (reading) và nghĩa (meaningVn) riêng của chính từ đó — không copy y hệt cách đọc mặc định của chữ gốc nếu từ đó thực ra đọc khác.`;

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
Mỗi từ cần: từ vựng gốc, phiên âm, nghĩa tiếng Việt ngắn gọn, một câu ví dụ tự nhiên, bản dịch tiếng Việt của câu ví dụ, và một mẹo nhớ ngắn (mnemonicVn) bằng tiếng Việt.
${POLYPHONY_INSTRUCTION}
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
Sau đó sinh 4 từ vựng thông dụng chứa chữ đó, kèm phiên âm, nghĩa tiếng Việt, câu ví dụ có bản dịch, và một mẹo nhớ ngắn (mnemonicVn) bằng tiếng Việt cho mỗi từ.
${POLYPHONY_INSTRUCTION}
${NEW_ROOT_JSON_SHAPE_HINT}`;
}

export function buildNewGroupPrompt(params: {
  language: Language;
  word: string;
  existingReadings: string[];
}): string {
  const langName = LANG_NAMES[params.language];
  return `Bạn là trợ lý dạy từ vựng ${langName} cho người Việt, chuyên về hiện tượng đồng âm dị nghĩa (nhiều chữ Hán/Hanja khác nhau đọc giống nhau nhưng nghĩa khác nhau).
Người học vừa nhập từ: "${params.word}" và muốn tạo một mindmap học từ mới xoay quanh từ này.
Hãy xác định MỘT chữ Hán/Hanja gốc tiêu biểu trong từ đó (thường là chữ quan trọng nhất về nghĩa hoặc chữ đầu tiên) cùng cách đọc của chữ gốc đó trong ${langName}.
Các cách đọc nhóm đã tồn tại rồi (chỉ để tham khảo — cứ chọn đúng cách đọc thật của từ người dùng nhập,
hệ thống sẽ tự động gộp vào nhóm cùng âm nếu trùng, không cần bạn tự tránh): ${params.existingReadings.join(", ") || "(chưa có)"}.
Sau đó sinh 4 từ vựng thông dụng chứa chữ gốc đó (nếu phù hợp, hãy để chính từ "${params.word}" người dùng nhập là một trong các từ này), kèm phiên âm, nghĩa tiếng Việt, câu ví dụ có bản dịch, và một mẹo nhớ ngắn (mnemonicVn) bằng tiếng Việt cho mỗi từ.
${POLYPHONY_INSTRUCTION}
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
Mỗi từ cần: từ vựng gốc, phiên âm, nghĩa tiếng Việt ngắn gọn, một câu ví dụ tự nhiên, bản dịch tiếng Việt của câu ví dụ, và một mẹo nhớ ngắn (mnemonicVn) bằng tiếng Việt.
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

/** Ngữ pháp: AI CHỈ được dùng để bổ sung thêm ví dụ/mẹo nhớ cho 1 điểm ngữ pháp đã soạn tay sẵn — không
 * sinh cấu trúc/quy tắc ngữ pháp mới (quyết định của user, xem Features.md mục 7). */
export function buildGrammarExtraExamplePrompt(params: {
  language: Language;
  pattern: string;
  meaningVn: string;
  nuanceVn: string;
  existingSentences: string[];
}): string {
  const langName = LANG_NAMES[params.language];
  return `Bạn là trợ lý dạy ngữ pháp ${langName} cho người Việt.
Cấu trúc ngữ pháp: "${params.pattern}" — nghĩa: ${params.meaningVn}.
Sắc thái/cách dùng: ${params.nuanceVn}.
Hãy tạo THÊM 1 câu ví dụ MỚI minh hoạ ĐÚNG cấu trúc này, tự nhiên, phù hợp trình độ sơ-trung cấp.
KHÔNG được trùng hoặc quá giống với các câu đã có: ${params.existingSentences.join(" | ") || "(chưa có)"}.
${GRAMMAR_EXAMPLE_JSON_SHAPE_HINT}`;
}

export function buildGrammarExtraMnemonicPrompt(params: {
  language: Language;
  pattern: string;
  meaningVn: string;
  nuanceVn: string;
  existingTips: string[];
}): string {
  const langName = LANG_NAMES[params.language];
  return `Bạn là trợ lý dạy ngữ pháp ${langName} cho người Việt.
Cấu trúc ngữ pháp: "${params.pattern}" — nghĩa: ${params.meaningVn}.
Sắc thái/cách dùng: ${params.nuanceVn}.
Hãy nghĩ ra THÊM 1 mẹo nhớ ngắn gọn (1-2 câu) bằng tiếng Việt, khác cách tiếp cận với các mẹo đã có,
giúp người học nhớ cấu trúc này. Viết tự nhiên, dí dỏm, dễ nhớ, không giải thích dài dòng.
KHÔNG được lặp lại ý của các mẹo đã có: ${params.existingTips.join(" | ") || "(chưa có)"}.
${MNEMONIC_JSON_SHAPE_HINT}`;
}
