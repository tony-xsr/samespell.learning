import type { Language } from "@/types/vocab";

/** 3 dạng câu hỏi round 1 (chỉ test từ vựng — xem Features.md mục Test kiến thức):
 * "meaning" = nhìn từ, chọn đúng nghĩa; "reading" = nhìn từ, chọn đúng cách đọc; "cloze" = điền từ
 * đúng vào câu ví dụ đã che từ. */
export type QuizMode = "meaning" | "reading" | "cloze";

/** Trục nguồn của 1 từ trong pool — dùng để ưu tiên chọn đáp án nhiễu "gần giống thật" (cùng nhóm
 * đồng âm/hình/bẫy nghĩa/phụ âm đầu sẽ là nhiễu khó hơn nhiều so với 1 từ ngẫu nhiên bất kỳ). */
export type QuizAxisKind = "sound" | "shape" | "false-friend" | "initial" | "topic";

/** 1 từ vựng đã "làm phẳng" từ SoundGroup hoặc TopicGroup, kèm ngữ cảnh nguồn để chọn nhiễu. */
export interface QuizWordEntry {
  id: string;
  headword: string;
  reading: string;
  meaningVn: string;
  example: string;
  exampleVn: string;
  /** id của root/branch chứa từ này — các từ cùng sourceKey là nhiễu "gần giống" ưu tiên hàng đầu. */
  sourceKey: string;
  axisKind: QuizAxisKind;
}

export interface QuizOption {
  id: string;
  label: string;
  correct: boolean;
}

export interface QuizQuestion {
  id: string;
  language: Language;
  mode: QuizMode;
  /** Đề bài hiển thị: headword (mode meaning/reading) hoặc câu ví dụ đã che từ (mode cloze). */
  promptLabel: string;
  /** Phụ đề nhỏ dưới đề bài (vd cách đọc của headword ở mode meaning/cloze) — có thể rỗng. */
  promptSubLabel?: string;
  options: QuizOption[];
  /** id của từ đúng — dùng để gọi POST /api/progress/rate sau khi trả lời. */
  answerWordId: string;
}
