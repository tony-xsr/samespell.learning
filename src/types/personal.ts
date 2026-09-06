import type { GroupKind, Language } from "./vocab";

/** Bộ sưu tập cá nhân của người học — 3 tầng theo Features.md mục 14:
 * 1) "My New Vocab" (log riêng, xem newVocabLog.ts) — tự động, không nằm ở đây.
 * 2) favorites — lưu CẢ 1 mindmap (không phải từng từ, khác WordProgress.bookmarked).
 * 3) lists — danh mục tự đặt tên (vd "Từ khó nhớ"), chứa cả mindmap lẫn từ đơn lẻ. */

export interface FavoriteGroupRef {
  /** Khoá duy nhất để chống trùng: `${language}:${groupKind}:${groupId}`. */
  key: string;
  language: Language;
  groupKind: GroupKind;
  groupId: string;
  savedAt: string;
}

export interface PersonalList {
  id: string;
  name: string;
  /** Mỗi phần tử là 1 itemId đã encode qua encodeGroupItemId/encodeWordItemId bên dưới. */
  itemIds: string[];
  createdAt: string;
}

export interface PersonalCollections {
  favorites: FavoriteGroupRef[];
  lists: PersonalList[];
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
