import type { GroupKind, Language } from "./vocab";

/** Bộ sưu tập cá nhân của người học — 4 tầng theo Features.md mục 14 và 22:
 * 1) "My New Vocab" (log riêng, xem newVocabLog.ts) — tự động, không nằm ở đây.
 * 2) favorites — lưu CẢ 1 mindmap (không phải từng từ, khác WordProgress.bookmarked).
 * 3) lists — danh mục tự đặt tên (vd "Từ khó nhớ"), chứa cả mindmap lẫn từ đơn lẻ.
 * 4) learned — đánh dấu ĐÃ HỌC XONG cả 1 mindmap. Khác `WordProgress.mastered` (cấp TỪNG TỪ,
 *    do SRS quản) ở chỗ đây là tuyên bố thủ công của người học về CẢ nhóm, và có mốc thời gian
 *    `learnedAt` nên dựng được "danh sách đã học" sắp theo ngày. Xem Features.md mục 22. */

export interface FavoriteGroupRef {
  /** Khoá duy nhất để chống trùng: `${language}:${groupKind}:${groupId}`. */
  key: string;
  language: Language;
  groupKind: GroupKind;
  groupId: string;
  savedAt: string;
}

/** Cùng khoá `favoriteKey` với FavoriteGroupRef (một mindmap vừa có thể được yêu thích vừa được
 * đánh dấu đã học — hai trạng thái độc lập nhau). */
export interface LearnedGroupRef {
  key: string;
  language: Language;
  groupKind: GroupKind;
  groupId: string;
  learnedAt: string;
}

export interface PersonalList {
  id: string;
  name: string;
  /** Mỗi phần tử là 1 itemId đã encode qua encodeGroupItemId/encodeWordItemId bên dưới. */
  itemIds: string[];
  createdAt: string;
}

/** Cài đặt cho nghi thức học hàng ngày (Features.md mục 25). */
export interface RitualSettings {
  /** Ngày nghỉ trong tuần, 0 = Chủ nhật … 6 = Thứ bảy. Nghỉ thì không tính là học nhưng cũng KHÔNG
   * làm đứt chuỗi ngày. Tối đa 3 ngày (xem MAX_REST_DAYS). */
  restDays: number[];
}

export interface PersonalCollections {
  favorites: FavoriteGroupRef[];
  lists: PersonalList[];
  /** Optional vì dữ liệu đã lưu từ trước mục 22 chưa có khoá này — loader luôn mặc định `[]`. */
  learned?: LearnedGroupRef[];
  /** Optional vì dữ liệu lưu từ trước mục 25 chưa có khoá này. */
  ritual?: RitualSettings;
}

export function favoriteKey(language: Language, groupKind: GroupKind, groupId: string): string {
  return `${language}:${groupKind}:${groupId}`;
}

export function encodeGroupItemId(language: Language, groupKind: GroupKind, groupId: string): string {
  return `group:${language}:${groupKind}:${groupId}`;
}

/** Ghi kèm groupKind+groupId (không chỉ wordId) để tra ngược lại 1 từ chỉ cần đọc ĐÚNG 1 group thay
 * vì phải quét toàn bộ 4 pool sound/shape/false-friend/initial của 1 ngôn ngữ mới tìm ra nó. */
export function encodeWordItemId(
  language: Language,
  groupKind: GroupKind,
  groupId: string,
  wordId: string,
): string {
  return `word:${language}:${groupKind}:${groupId}:${wordId}`;
}

export type DecodedItemId =
  | { type: "group"; language: Language; groupKind: GroupKind; groupId: string }
  | { type: "word"; language: Language; groupKind: GroupKind; groupId: string; wordId: string };

export function decodeItemId(itemId: string): DecodedItemId | null {
  const parts = itemId.split(":");
  if (parts[0] === "group" && parts.length === 4) {
    return {
      type: "group",
      language: parts[1] as Language,
      groupKind: parts[2] as GroupKind,
      groupId: parts[3],
    };
  }
  if (parts[0] === "word" && parts.length === 5) {
    return {
      type: "word",
      language: parts[1] as Language,
      groupKind: parts[2] as GroupKind,
      groupId: parts[3],
      wordId: parts[4],
    };
  }
  return null;
}

/** Đường dẫn cơ sở tới trang mindmap theo từng trục nhầm lẫn — khớp với `basePath` mà
 * GroupExplorer.tsx đang dùng ("" cho sound, "/shapes" cho shape...). */
export function groupKindBasePath(groupKind: GroupKind): string {
  switch (groupKind) {
    case "shape":
      return "/shapes";
    case "false-friend":
      return "/false-friends";
    case "initial":
      return "/initials";
    default:
      return "";
  }
}

export function groupKindLabel(groupKind: GroupKind): string {
  switch (groupKind) {
    case "shape":
      return "Nhóm hình";
    case "false-friend":
      return "Bẫy nghĩa";
    case "initial":
      return "Cùng âm đầu";
    default:
      return "Nhóm âm";
  }
}
