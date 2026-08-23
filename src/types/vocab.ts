export type Language = "zh" | "ko" | "ja";

export interface VocabWord {
  id: string;
  headword: string;
  reading: string;
  meaningVn: string;
  example: string;
  exampleVn: string;
  grammarPoint?: string;
  grammarExplanationVn?: string;
  mnemonicVn?: string;
  children?: VocabWord[];
}

export interface RootEntry {
  id: string;
  character: string;
  meaningVn: string;
  hanViet?: string;
  reading?: string;
  words: VocabWord[];
}

export interface SoundGroup {
  id: string;
  language: Language;
  reading: string;
  note?: string;
  roots: RootEntry[];
  /** Trục nhầm lẫn: "sound" (mặc định, đọc giống nhau), "shape" (viết giống nhau, hình cận tự),
   * "false-friend" (1 chữ dùng chung nhưng nghĩa từ ghép lệch nhau), hay "initial" (chỉ trùng phụ âm
   * đầu pinyin, không liên quan âm/nghĩa). */
  groupKind?: "sound" | "shape" | "false-friend" | "initial";
  /** Danh mục chủ đề để gom nhóm trên trang tổng quan (vd "Con người & cơ thể", "Cây cỏ"...). */
  category?: string;
}

export interface LanguageData {
  language: Language;
  label: string;
  groups: SoundGroup[];
}

export type SrsRating = 0 | 1 | 2 | 3;

export interface WordProgress {
  interval: number;
  ease: number;
  dueAt: string;
  reviewCount: number;
  lastRating?: SrsRating;
  bookmarked?: boolean;
  mastered?: boolean;
}

export type ProgressStore = Record<string, WordProgress>;
