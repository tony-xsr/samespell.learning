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
  /** Mẹo nhớ AI-generated nếu từ đã có sẵn (không phải từ nào cũng có). */
  mnemonicVn?: string;
  /** Chữ gốc của nhóm đồng âm/hình/bẫy nghĩa chứa từ này — chỉ có ở axisKind sound/shape/false-friend/
   * initial (chủ đề mindmap không tổ chức theo chữ gốc nên topic-axis luôn thiếu 3 trường này). */
  rootChar?: string;
  rootHanViet?: string;
  rootMeaning?: string;
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
  /** Chi tiết đầy đủ của từ đúng — dùng để phát âm (mọi mode) và hiển thị bảng giải thích đầy đủ khi
   * bật chế độ "chờ xem giải thích" (xem QuizSession). Không phụ thuộc mode nên luôn có sẵn, kể cả ở
   * mode reading/cloze nơi promptLabel không phải là headword. */
  answerHeadword: string;
  answerReading: string;
  answerMeaningVn: string;
  answerExample: string;
  answerExampleVn: string;
  answerMnemonicVn?: string;
  answerRootChar?: string;
  answerRootHanViet?: string;
  answerRootMeaning?: string;
}
