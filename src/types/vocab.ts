export type Language = "zh" | "ko" | "ja" | "en";

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

/** Trục nhầm lẫn: "sound" (mặc định, đọc giống nhau), "shape" (viết giống nhau, hình cận tự),
 * "false-friend" (1 chữ dùng chung nhưng nghĩa từ ghép lệch nhau), hay "initial" (chỉ trùng phụ âm
 * đầu pinyin, không liên quan âm/nghĩa). Tách thành type riêng để tái dùng ở personal.ts (favorite/
 * danh mục cá nhân cần biết 1 group thuộc trục nào để tra đúng nguồn dữ liệu). */
export type GroupKind = "sound" | "shape" | "false-friend" | "initial";

export interface SoundGroup {
  id: string;
  language: Language;
  reading: string;
  note?: string;
  roots: RootEntry[];
  groupKind?: GroupKind;
  /** Danh mục chủ đề để gom nhóm trên trang tổng quan (vd "Con người & cơ thể", "Cây cỏ"...). */
  category?: string;
  /** Theme AI đã dùng để tự sinh group này khi người dùng gõ từ (vd "polyphonic", "synonym-family")
   * — CHỈ có ở group AI tự tạo với theme khác mặc định "sound"; vắng mặt với mọi group soạn sẵn và
   * group AI tạo theo theme mặc định. Dùng để hiển thị badge + không áp dụng merge-theo-reading (xem
   * /api/generate route.ts) vì các theme này không có ý nghĩa "cùng âm = cùng nhóm". Xem Features.md
   * mục 14.2. */
  aiTheme?: string;
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
