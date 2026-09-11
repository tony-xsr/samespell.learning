import type { Language } from "@/types/vocab";

/** 2 dạng câu hỏi trắc nghiệm ngữ pháp (tách riêng khỏi bộ ôn thẻ lật `GrammarReviewSession` — xem
 * yêu cầu người dùng: "1 chế độ luyện trắc nghiệm RIÊNG", giống /test hiện có cho từ vựng nhưng cho
 * ngữ pháp):
 * - "meaning": nhìn cấu trúc (pattern), chọn đúng nghĩa tiếng Việt.
 * - "usage": nhìn 1 câu ví dụ (kèm nghĩa — nghĩa ở đây LÀ NGỮ CẢNH cần để chọn, không phải đáp án nên
 *   không cần ẩn), chọn đúng cấu trúc ngữ pháp nào đang được minh hoạ — tổng quát hoá thẻ "⚡ Chọn
 *   đúng cấu trúc" đã có sẵn trong `GrammarReviewSession` (vốn chỉ trộn NGẪU NHIÊN, giới hạn trong
 *   từng cụm dễ nhầm) thành 1 chế độ luyện riêng, bao phủ TOÀN BỘ điểm ngữ pháp, ưu tiên nhiễu từ
 *   cùng cụm dễ nhầm nếu có. */
export type GrammarQuizMode = "meaning" | "usage";

/** 1 điểm ngữ pháp đã "làm phẳng" từ `GrammarLanguageData`, kèm khoá nhóm để chọn nhiễu "gần giống"
 * (ưu tiên cùng cụm dễ nhầm — khó nhất — rồi mới tới cùng category, giống hệt tinh thần
 * `pickDistractors` ở `lib/quiz/generator.ts` cho từ vựng). */
export interface GrammarQuizEntry {
  id: string;
  pattern: string;
  formationRule: string;
  meaningVn: string;
  nuanceVn: string;
  categoryId: string;
  confusionGroupId?: string;
  example: { sentence: string; translationVn: string; note?: string };
  mnemonicVn: string;
  commonMistakeVn?: string;
}

export interface GrammarQuizOption {
  id: string;
  label: string;
  correct: boolean;
}

export interface GrammarQuizQuestion {
  id: string;
  language: Language;
  mode: GrammarQuizMode;
  /** Đề bài hiển thị: pattern (mode meaning) hoặc câu ví dụ gốc (mode usage). */
  promptLabel: string;
  /** Phụ đề nhỏ dưới đề bài — cách chia (mode meaning) hoặc rỗng (mode usage, xem promptTranslationVn). */
  promptSubLabel?: string;
  /** CHỈ ở mode usage — nghĩa tiếng Việt của câu ví dụ, hiển thị NGAY (là ngữ cảnh cần để chọn đúng
   * cấu trúc, không phải đáp án nên không ẩn — khác hẳn ví dụ trong `GrammarReviewSession`). */
  promptTranslationVn?: string;
  options: GrammarQuizOption[];
  /** id của điểm ngữ pháp đúng — dùng để gọi `rateGrammarCard` sau khi trả lời, đồng bộ SRS chung với
   * bộ ôn thẻ lật. */
  answerPointId: string;
  answerPattern: string;
  answerFormationRule: string;
  answerMeaningVn: string;
  answerNuanceVn: string;
  answerExample: string;
  answerExampleVn: string;
  answerExampleNote?: string;
  answerMnemonicVn: string;
  answerCommonMistakeVn?: string;
}
