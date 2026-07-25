import { z } from "zod";

export const WordSchema = z.object({
  headword: z.string().min(1).describe("Từ vựng viết bằng chữ của ngôn ngữ đích"),
  reading: z.string().min(1).describe("Phiên âm đọc của cả từ (pinyin/romaja/romaji)"),
  meaningVn: z.string().min(1).describe("Nghĩa tiếng Việt ngắn gọn"),
  example: z.string().min(1).describe("Một câu ví dụ ngắn, tự nhiên, dùng từ này"),
  exampleVn: z.string().min(1).describe("Bản dịch tiếng Việt của câu ví dụ"),
  grammarPoint: z
    .string()
    .optional()
    .describe(
      "Chỉ điền nếu ngôn ngữ là tiếng Hàn hoặc tiếng Nhật VÀ câu ví dụ minh hoạ rõ một điểm ngữ pháp đặc trưng (vd: dạng -았/었, thể て, trợ từ は/が...). Ghi tên ngắn gọn của điểm ngữ pháp đó. Bỏ trống nếu không có gì đặc biệt hoặc là tiếng Trung.",
    ),
  grammarExplanationVn: z
    .string()
    .optional()
    .describe("Giải thích ngắn gọn bằng tiếng Việt về điểm ngữ pháp nêu ở grammarPoint. Bỏ trống nếu grammarPoint trống."),
  mnemonicVn: z
    .string()
    .min(1)
    .describe(
      "LUÔN điền: mẹo nhớ ngắn gọn (1-2 câu) bằng tiếng Việt cho từ này, dựa trên cách phát âm nghe giống từ/âm tiếng Việt nào và/hoặc liên tưởng hình ảnh gắn với nghĩa của từ. Viết tự nhiên, dí dỏm, dễ nhớ.",
    ),
});

export const ExpandRootSchema = z.object({
  words: z.array(WordSchema).describe("Danh sách từ mới, không trùng với các từ đã có"),
});

export const NewRootSchema = z.object({
  character: z.string().min(1).describe("Chữ Hán/Hanja gốc"),
  hanViet: z.string().min(1).describe("Âm Hán Việt tương ứng của chữ gốc, ví dụ: mộc, mục, sự"),
  meaningVn: z.string().min(1).describe("Nghĩa cốt lõi của chữ gốc bằng tiếng Việt"),
  reading: z.string().min(1).describe("Phiên âm đọc của chữ gốc trong ngôn ngữ đích"),
  words: z.array(WordSchema).min(3).max(6),
});

export const MnemonicSchema = z.object({
  mnemonicVn: z
    .string()
    .min(1)
    .describe(
      "Mẹo nhớ ngắn gọn bằng tiếng Việt (1-2 câu), dựa trên cách phát âm và/hoặc nghĩa của từ, giúp người Việt nhớ từ này dễ hơn.",
    ),
});

export type ExpandRootResult = z.infer<typeof ExpandRootSchema>;
export type NewRootResult = z.infer<typeof NewRootSchema>;
export type MnemonicResult = z.infer<typeof MnemonicSchema>;

export const WORD_JSON_SHAPE_HINT = [
  "Mỗi từ trong mảng words PHẢI đúng dạng JSON sau (không thêm field khác, không dùng markdown code fence):",
  '{"headword": "...", "reading": "...", "meaningVn": "...", "example": "...", "exampleVn": "...", "grammarPoint": "" , "grammarExplanationVn": "", "mnemonicVn": "..."}',
  "grammarPoint/grammarExplanationVn: chỉ điền khi ngôn ngữ là Hàn hoặc Nhật và câu ví dụ minh hoạ một điểm ngữ pháp đặc trưng; nếu không có gì đặc biệt thì để chuỗi rỗng.",
  "mnemonicVn: LUÔN điền cho MỌI từ — 1-2 câu tiếng Việt giúp nhớ từ (chơi chữ theo âm đọc và/hoặc liên tưởng theo nghĩa), không để trống.",
].join("\n");

export const EXPAND_ROOT_JSON_SHAPE_HINT = `Trả lời CHỈ một JSON object dạng: {"words": [ ... ]}\n${WORD_JSON_SHAPE_HINT}`;

export const NEW_ROOT_JSON_SHAPE_HINT = `Trả lời CHỈ một JSON object dạng: {"character": "...", "hanViet": "...", "meaningVn": "...", "reading": "...", "words": [ ... ]}\n${WORD_JSON_SHAPE_HINT}`;

export const MNEMONIC_JSON_SHAPE_HINT = `Trả lời CHỈ một JSON object dạng: {"mnemonicVn": "..."} (không thêm field khác, không dùng markdown code fence).`;
