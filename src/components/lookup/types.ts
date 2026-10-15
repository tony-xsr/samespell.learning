import type { LookupResult } from "@/lib/lookupIndex";

/** 1 kết quả tra nhanh như API /api/lookup trả về (kèm trạng thái ôn tập đọc mới mỗi lần tra). */
export type LookupItem = LookupResult & { inReview: boolean; bookmarked: boolean };

/** Mở bảng Tra nhanh từ bất kỳ đâu: `window.dispatchEvent(new CustomEvent(OPEN_LOOKUP_EVENT, { detail }))`. */
export const OPEN_LOOKUP_EVENT = "open-quick-lookup";
export interface OpenLookupDetail {
  query?: string;
  lang?: "zh" | "ko" | "ja" | "en" | "es";
}
