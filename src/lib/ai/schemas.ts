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
  note: z
    .string()
    .optional()
    .describe(
      "CHỈ điền khi được yêu cầu rõ (vd giải thích đa âm, giải thích khác biệt sắc thái/từ trái nghĩa) — 1-2 câu tiếng Việt. Bỏ trống nếu không được yêu cầu.",
    ),
});

/** AI cho theme "📖 Giải thích nhanh" (answer-card, KHÔNG phải mindmap) — chỉ tra nghĩa 1 từ, không
 * mở rộng thêm từ liên quan. Xem Features.md mục 14.2 nhóm B. */
export const QuickDictSchema = z.object({
  headword: z.string().min(1).describe("Từ vựng gốc, giữ nguyên như người dùng nhập"),
  reading: z.string().min(1).describe("Phiên âm đọc của cả từ"),
  wordClass: z.string().optional().describe("Loại từ ngắn gọn, vd 'danh từ', 'động từ'... để trống nếu không rõ"),
  meaningVn: z.string().min(1).describe("Nghĩa tiếng Việt ngắn gọn"),
  example: z.string().min(1).describe("Một câu ví dụ ngắn, tự nhiên"),
  exampleVn: z.string().min(1).describe("Bản dịch tiếng Việt của câu ví dụ"),
});

/** AI cho theme "🀄 Chiết tự Hán" (answer-card) — chỉ áp dụng zh/ja (có chữ Hán/Kanji thật). */
export const EtymologySchema = z.object({
  headword: z.string().min(1),
  reading: z.string().min(1),
  radical: z.string().min(1).describe("Bộ thủ chính của chữ được phân tích"),
  radicalMeaningVn: z.string().min(1).describe("Nghĩa của bộ thủ đó bằng tiếng Việt"),
  componentsVn: z.string().min(1).describe("Mô tả ngắn các thành phần cấu tạo còn lại của chữ, bằng tiếng Việt"),
  explanationVn: z.string().min(1).describe("Giải thích vì sao các thành phần ghép lại cho ra nghĩa của chữ"),
  mnemonicVn: z.string().min(1).describe("Mẹo nhớ ngắn gọn bằng tiếng Việt dựa trên cấu tạo chữ"),
});

export const MnemonicSchema = z.object({
  mnemonicVn: z
    .string()
    .min(1)
    .describe(
      "Mẹo nhớ ngắn gọn bằng tiếng Việt (1-2 câu), dựa trên cách phát âm và/hoặc nghĩa của từ, giúp người Việt nhớ từ này dễ hơn.",
    ),
});

/** AI cho NGỮ PHÁP — chỉ dùng để bổ sung THÊM ví dụ/mẹo nhớ cho 1 điểm ngữ pháp đã soạn tay sẵn,
 * KHÔNG dùng để sinh cấu trúc/quy tắc ngữ pháp mới (quyết định của user — xem Features.md mục 7). */
export const GrammarExampleSchema = z.object({
  sentence: z.string().min(1).describe("Câu ví dụ mới bằng ngôn ngữ gốc, minh hoạ đúng cấu trúc ngữ pháp"),
  translationVn: z.string().min(1).describe("Bản dịch tiếng Việt của câu ví dụ"),
  note: z.string().optional().describe("Ghi chú ngắn giải thích vì sao câu này minh hoạ đúng cấu trúc, có thể để trống"),
});

/** AI cho theme "🧠 Giải thích sâu & mẹo nhớ" (answer-card) — khác "quick-dict" ở chỗ đào sâu sắc
 * thái/ngữ cảnh dùng thay vì chỉ tra nghĩa, kèm mẹo nhớ. */
export const ExplainMnemonicSchema = z.object({
  headword: z.string().min(1),
  reading: z.string().min(1),
  meaningVn: z.string().min(1).describe("Nghĩa tiếng Việt ngắn gọn"),
  explanationVn: z
    .string()
    .min(1)
    .describe(
      "Giải thích sâu bằng tiếng Việt: sắc thái, ngữ cảnh/tình huống nên dùng từ này, và (nếu có từ gần nghĩa dễ nhầm) khi nào nên dùng từ này thay vì từ đó.",
    ),
  mnemonicVn: z.string().min(1).describe("Mẹo nhớ ngắn gọn bằng tiếng Việt dựa trên âm đọc và/hoặc hình ảnh liên tưởng."),
});

/** AI cho theme "📝 Thêm ví dụ" (answer-card) — nhiều câu ví dụ ở NHIỀU ngữ cảnh khác nhau cho 1 từ. */
export const ExampleSetSchema = z.object({
  headword: z.string().min(1),
  reading: z.string().min(1),
  meaningVn: z.string().min(1),
  examples: z
    .array(
      z.object({
        sentence: z.string().min(1).describe("Câu ví dụ tự nhiên dùng từ này"),
        translationVn: z.string().min(1).describe("Bản dịch tiếng Việt của câu ví dụ"),
        contextVn: z.string().optional().describe("Ngắn gọn: ngữ cảnh/tình huống của câu này (vd 'văn nói thân mật', 'email công việc'), có thể để trống"),
      }),
    )
    .min(3)
    .max(4)
    .describe("3-4 câu ví dụ ở CÁC ngữ cảnh/sắc thái KHÁC nhau, không lặp lại cùng 1 kiểu câu"),
});

/** AI cho theme "🔗 Từ đồng nghĩa" (answer-card) — các từ gần nghĩa kèm khác biệt sắc thái, KHÔNG
 * phải mindmap cây như theme "synonym-family" đã có (theme đó tạo group mới, theme này chỉ tra cứu
 * nhanh và lưu vào lịch sử "Mới thêm"). */
export const SynonymSetSchema = z.object({
  headword: z.string().min(1),
  reading: z.string().min(1),
  meaningVn: z.string().min(1),
  synonyms: z
    .array(
      z.object({
        word: z.string().min(1),
        reading: z.string().min(1),
        nuanceVn: z.string().min(1).describe("Khác biệt sắc thái/mức độ trang trọng/ngữ cảnh dùng so với từ gốc, bằng tiếng Việt"),
      }),
    )
    .min(3)
    .max(5)
    .describe("3-5 từ gần nghĩa THỰC SỰ tồn tại, không phải đồng nghĩa tuyệt đối — mỗi từ phải khác sắc thái theo cách riêng"),
});

/** AI cho theme "🧩 Cụm từ đi cùng" (answer-card) — collocation: các cụm từ/tổ hợp thông dụng có
 * chứa từ gốc, khác "Thêm ví dụ" ở chỗ đây là CỤM TỪ ngắn (không phải câu hoàn chỉnh). */
export const CollocationSetSchema = z.object({
  headword: z.string().min(1),
  reading: z.string().min(1),
  meaningVn: z.string().min(1),
  collocations: z
    .array(
      z.object({
        phrase: z.string().min(1).describe("Cụm từ/tổ hợp thông dụng có chứa từ gốc (KHÔNG phải câu hoàn chỉnh)"),
        meaningVn: z.string().min(1).describe("Nghĩa tiếng Việt ngắn gọn của cả cụm"),
      }),
    )
    .min(4)
    .max(6)
    .describe("4-6 cụm từ/tổ hợp THỰC SỰ thông dụng đi kèm từ gốc trong giao tiếp thực tế"),
});

export type ExpandRootResult = z.infer<typeof ExpandRootSchema>;
export type NewRootResult = z.infer<typeof NewRootSchema>;
export type QuickDictResult = z.infer<typeof QuickDictSchema>;
export type EtymologyResult = z.infer<typeof EtymologySchema>;
export type MnemonicResult = z.infer<typeof MnemonicSchema>;
export type GrammarExampleResult = z.infer<typeof GrammarExampleSchema>;
export type ExplainMnemonicResult = z.infer<typeof ExplainMnemonicSchema>;
export type ExampleSetResult = z.infer<typeof ExampleSetSchema>;
export type SynonymSetResult = z.infer<typeof SynonymSetSchema>;
export type CollocationSetResult = z.infer<typeof CollocationSetSchema>;

export const WORD_JSON_SHAPE_HINT = [
  "Mỗi từ trong mảng words PHẢI đúng dạng JSON sau (không thêm field khác, không dùng markdown code fence):",
  '{"headword": "...", "reading": "...", "meaningVn": "...", "example": "...", "exampleVn": "...", "grammarPoint": "" , "grammarExplanationVn": "", "mnemonicVn": "..."}',
  "grammarPoint/grammarExplanationVn: chỉ điền khi ngôn ngữ là Hàn hoặc Nhật và câu ví dụ minh hoạ một điểm ngữ pháp đặc trưng; nếu không có gì đặc biệt thì để chuỗi rỗng.",
  "mnemonicVn: LUÔN điền cho MỌI từ — 1-2 câu tiếng Việt giúp nhớ từ (chơi chữ theo âm đọc và/hoặc liên tưởng theo nghĩa), không để trống.",
].join("\n");

export const EXPAND_ROOT_JSON_SHAPE_HINT = `Trả lời CHỈ một JSON object dạng: {"words": [ ... ]}\n${WORD_JSON_SHAPE_HINT}`;

export const NEW_ROOT_JSON_SHAPE_HINT = `Trả lời CHỈ một JSON object dạng: {"character": "...", "hanViet": "...", "meaningVn": "...", "reading": "...", "words": [ ... ], "note": "..."}\n${WORD_JSON_SHAPE_HINT}\nnote: chỉ điền nếu được yêu cầu rõ ở trên, nếu không thì để chuỗi rỗng.`;

export const MNEMONIC_JSON_SHAPE_HINT = `Trả lời CHỈ một JSON object dạng: {"mnemonicVn": "..."} (không thêm field khác, không dùng markdown code fence).`;

export const QUICK_DICT_JSON_SHAPE_HINT = `Trả lời CHỈ một JSON object dạng: {"headword": "...", "reading": "...", "wordClass": "...", "meaningVn": "...", "example": "...", "exampleVn": "..."} (wordClass có thể để chuỗi rỗng nếu không rõ, không thêm field khác, không dùng markdown code fence).`;

export const ETYMOLOGY_JSON_SHAPE_HINT = `Trả lời CHỈ một JSON object dạng: {"headword": "...", "reading": "...", "radical": "...", "radicalMeaningVn": "...", "componentsVn": "...", "explanationVn": "...", "mnemonicVn": "..."} (không thêm field khác, không dùng markdown code fence).`;

export const GRAMMAR_EXAMPLE_JSON_SHAPE_HINT = `Trả lời CHỈ một JSON object dạng: {"sentence": "...", "translationVn": "...", "note": "..."} (note có thể để chuỗi rỗng nếu không cần, không thêm field khác, không dùng markdown code fence).`;

export const EXPLAIN_MNEMONIC_JSON_SHAPE_HINT = `Trả lời CHỈ một JSON object dạng: {"headword": "...", "reading": "...", "meaningVn": "...", "explanationVn": "...", "mnemonicVn": "..."} (không thêm field khác, không dùng markdown code fence).`;

export const EXAMPLE_SET_JSON_SHAPE_HINT = `Trả lời CHỈ một JSON object dạng: {"headword": "...", "reading": "...", "meaningVn": "...", "examples": [{"sentence": "...", "translationVn": "...", "contextVn": "..."}, ...]} (mảng examples có 3-4 phần tử, contextVn có thể để chuỗi rỗng, không thêm field khác, không dùng markdown code fence).`;

export const SYNONYM_SET_JSON_SHAPE_HINT = `Trả lời CHỈ một JSON object dạng: {"headword": "...", "reading": "...", "meaningVn": "...", "synonyms": [{"word": "...", "reading": "...", "nuanceVn": "..."}, ...]} (mảng synonyms có 3-5 phần tử, không thêm field khác, không dùng markdown code fence).`;

export const COLLOCATION_SET_JSON_SHAPE_HINT = `Trả lời CHỈ một JSON object dạng: {"headword": "...", "reading": "...", "meaningVn": "...", "collocations": [{"phrase": "...", "meaningVn": "..."}, ...]} (mảng collocations có 4-6 phần tử, không thêm field khác, không dùng markdown code fence).`;
