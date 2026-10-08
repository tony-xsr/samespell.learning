export type Language = "zh" | "ko" | "ja" | "en" | "es";

/** Nội dung này từ đâu ra.
 * - `curated` (mặc định, vắng mặt): soạn sẵn trong `data/*.json`, đi theo mã nguồn.
 * - `user`: do CHÍNH người học thêm vào tài khoản mình (gõ tay hoặc nhờ AI sinh rồi lưu lại), nằm
 *   trong KV chứ không trong repo.
 *
 * KHÔNG lưu trường này xuống KV: nó được đóng dấu ngay lúc trộn dữ liệu trong `vocabStore`, vì mọi
 * thứ đến từ kho `additions` theo định nghĩa đã là của người dùng. Nhờ vậy không phải sửa dữ liệu cũ
 * và không bao giờ có chuyện cờ bị lệch với thực tế. Xem Features.md mục 27. */
export type ContentSource = "curated" | "user";

export interface VocabWord {
  id: string;
  headword: string;
  reading: string;
  meaningVn: string;
  example: string;
  exampleVn: string;
  /** Cách đọc Hán Việt của TỪ GHÉP này (khác `RootEntry.hanViet`, vốn chỉ là cách đọc của 1 CHỮ neo).
   * Optional vì phần lớn dữ liệu cũ (trục âm/hình chính) chưa có — chỉ bắt buộc điền cho nội dung mới
   * ở trục bẫy nghĩa trở đi. Để trống/không set nếu từ không có Hán Việt tự nhiên (từ thuần Nhật/Hàn). */
  hanViet?: string;
  grammarPoint?: string;
  grammarExplanationVn?: string;
  mnemonicVn?: string;
  /** Loại từ, viết bằng tiếng Việt ngắn gọn ("danh từ", "động từ", "tính từ", "cụm từ"...).
   * Cùng tên với `QuickDictSchema.wordClass` để một khái niệm chỉ có một tên trong cả codebase. */
  wordClass?: string;
  /** Nhãn trình độ theo thang CHUẨN CỦA CHÍNH NGÔN NGỮ ĐÓ — HSK cho Trung, N1–N5 cho Nhật, TOPIK cho
   * Hàn, CEFR cho Anh/Tây Ban Nha. Xem `LEVEL_SCALE` trong src/lib/levels.ts.
   * Phần lớn nội dung soạn sẵn CHƯA có nhãn này (gắn cho ~3800 nhóm là một việc nội dung riêng);
   * nội dung do người học tự thêm thì được AI điền ngay từ lúc sinh. Xem Features.md mục 27. */
  level?: string;
  /** Xem ContentSource. Chỉ xuất hiện khi = "user". */
  source?: ContentSource;
  children?: VocabWord[];
}

export interface RootEntry {
  id: string;
  character: string;
  meaningVn: string;
  hanViet?: string;
  reading?: string;
  /** Xem ContentSource. Chỉ xuất hiện khi = "user". */
  source?: ContentSource;
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
  /** Xem ContentSource. Chỉ xuất hiện khi = "user". */
  source?: ContentSource;
  /** Danh mục chủ đề để gom nhóm trên trang tổng quan (vd "Con người & cơ thể", "Cây cỏ"...). */
  category?: string;
  /** Ngày mindmap này được THÊM vào kho (ISO). Dựng lại từ lịch sử git — commit đầu tiên mà group id
   * xuất hiện — nên là ngày thật, không phải ước lượng. Dùng để gắn nhãn "Mới" và sắp xếp theo ngày.
   * Lưu ý: đây là ngày thêm NHÓM, không phải ngày thêm từng từ bên trong (một nhóm cũ vẫn có thể
   * mới được bổ sung từ vựng gần đây). Xem Features.md mục 22. */
  addedAt?: string;
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
