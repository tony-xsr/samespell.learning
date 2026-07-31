import type { Language } from "@/types/vocab";

/** Bậc trình độ chung cho cả tiếng Hàn (TOPIK) và tiếng Nhật (JLPT), quy về 3 mức thực dụng
 * thay vì 6/5 mức chính thức — dễ lập kế hoạch soạn nội dung hơn (xem readme Features.md mục 8). */
export type GrammarLevel = "so-cap" | "trung-cap" | "cao-cap";

export interface GrammarExample {
  /** Câu ví dụ bằng tiếng gốc (Hàn/Nhật). */
  sentence: string;
  translationVn: string;
  /** Ghi chú ngắn giải thích VÌ SAO ví dụ này minh hoạ đúng điểm ngữ pháp — đặc biệt quan trọng khi
   * điểm ngữ pháp này nằm trong 1 cụm dễ nhầm (confusionGroupId), để làm rõ ranh giới với điểm kia. */
  note?: string;
}

/** Trục B (mindmap ngữ pháp) — vị trí trên "đường thời gian" từ quá khứ xa tới tương lai xa. */
export type GrammarTimeSlot = "qua-khu-xa" | "qua-khu-gan" | "hien-tai" | "tuong-lai-gan" | "tuong-lai-xa";

/** Trục phụ vuông góc với thời gian — "thể" (aspect): đơn thuần hay có sắc thái tiếp diễn/hoàn thành/
 * kinh nghiệm/dự định đã lên kế hoạch. Kết hợp với GrammarTimeSlot tạo thành lưới 2 chiều ở Trục B. */
export type GrammarAspect = "don-thuan" | "tiep-dien" | "hoan-thanh" | "kinh-nghiem" | "du-dinh";

export interface GrammarTimeAxis {
  time: GrammarTimeSlot;
  aspect: GrammarAspect;
}

export interface GrammarPoint {
  id: string;
  /** Cấu trúc/mẫu câu, vd "은/는", "〜たら". */
  pattern: string;
  /** Quy tắc chia/gắn vào từ loại đi kèm. */
  formationRule: string;
  meaningVn: string;
  /** Sắc thái riêng — phần quan trọng nhất để phân biệt với các điểm ngữ pháp cùng cụm nhầm lẫn. */
  nuanceVn: string;
  level: GrammarLevel;
  /** Độ trang trọng / văn phong: vd "thân mật", "trang trọng", "văn viết", "khẩu ngữ". */
  register?: string;
  /** Liên kết tới 1 GrammarConfusionGroup.id nếu điểm này dễ bị nhầm với (các) điểm ngữ pháp khác. */
  confusionGroupId?: string;
  /** Vị trí trên lưới Trục B (thời gian × thể) nếu điểm này là 1 dạng chia động từ theo thì — chỉ
   * gắn cho các điểm phù hợp (chủ yếu category chia động từ theo thì/tiếp diễn), không phải mọi điểm
   * ngữ pháp đều có vị trí trên trục thời gian (vd trợ từ, kính ngữ thì không). */
  timeAxis?: GrammarTimeAxis;
  examples: GrammarExample[];
  /** Lỗi sai điển hình học viên hay mắc khi dùng cấu trúc này. */
  commonMistakeVn?: string;
  mnemonicVn: string;
}

export interface GrammarCategory {
  id: string;
  titleVn: string;
  points: GrammarPoint[];
}

export interface GrammarConfusionGroup {
  id: string;
  titleVn: string;
  /** Tóm tắt cách phân biệt nhanh giữa các điểm ngữ pháp trong cụm này. */
  summaryVn: string;
  pointIds: string[];
}

export interface GrammarLanguageData {
  language: Language;
  label: string;
  categories: GrammarCategory[];
  confusionGroups: GrammarConfusionGroup[];
}

/** "Chuỗi ngữ cảnh" (thử nghiệm) — nối nhiều GrammarPoint đã có sẵn thành 1 mạch câu chuyện liền
 * mạch (vd hôm qua/hôm nay/ngày mai), KHÔNG tạo lại nội dung ngữ pháp — chỉ tham chiếu `pointId` +
 * chọn 1 ví dụ có sẵn trong `GrammarPoint.examples` của chính điểm đó qua `exampleIndex`. */
export interface GrammarStoryStep {
  pointId: string;
  exampleIndex: number;
  /** Nhãn ngữ cảnh ngắn cho bước này, vd "Hôm qua", "Bây giờ", "Ngày mai". */
  timeLabelVn: string;
}

export interface GrammarStory {
  id: string;
  titleVn: string;
  steps: GrammarStoryStep[];
}

/** "Cây quyết định" — 1 đoạn mở đầu chung (trunk), sau đó rẽ thành ≥2 nhánh phản hồi khác nhau (vd
 * đồng ý/từ chối lời rủ), mỗi nhánh minh hoạ 1 điểm ngữ pháp khác nhau. Cùng nguyên tắc với
 * GrammarStory — chỉ tham chiếu pointId/exampleIndex có sẵn, không tạo nội dung ngữ pháp mới. */
export interface GrammarBranchOption {
  labelVn: string;
  pointId: string;
  exampleIndex: number;
  timeLabelVn: string;
}

export interface GrammarBranchingStory {
  id: string;
  titleVn: string;
  trunk: GrammarStoryStep[];
  branches: GrammarBranchOption[];
}
