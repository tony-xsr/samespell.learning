import "server-only";
import type { GroupKind, Language } from "@/types/vocab";
import { decodeItemId } from "@/types/personal";
import { loadPersonalCollections } from "@/lib/personalCollectionsStore";
import { getGroupByKind, wordCount } from "@/lib/vocabStore";
import { flattenWords } from "@/lib/wordTree";
import { groupKindBasePath, groupKindLabel } from "@/types/personal";

/** Gộp thông tin cần hiển thị cho 1 group được tham chiếu (favorite hoặc nằm trong 1 danh mục) —
 * tra ngược lại dữ liệu group thật (reading, số từ...) từ groupId lưu trong personal collections,
 * vì bản thân favorite/list item chỉ lưu id, không lưu nội dung. */
export interface ResolvedGroupItem {
  kind: "group";
  itemId: string;
  language: Language;
  groupKind: GroupKind;
  groupId: string;
  reading: string;
  rootCount: number;
  wordCount: number;
  href: string;
  savedAt?: string;
}

/** Tương tự nhưng cho 1 TỪ đơn lẻ được thêm vào danh mục cá nhân (khác mindmap nguyên khối ở trên). */
export interface ResolvedWordItem {
  kind: "word";
  itemId: string;
  language: Language;
  groupKind: GroupKind;
  groupId: string;
  wordId: string;
  headword: string;
  reading: string;
  meaningVn: string;
  href: string;
}

export type ResolvedItem = ResolvedGroupItem | ResolvedWordItem;

export interface ResolvedList {
  id: string;
  name: string;
  createdAt: string;
  items: ResolvedItem[];
  /** itemId nào không tra ra được (group/từ đã bị xoá khỏi data gốc). */
  unresolvedCount: number;
}

async function resolveGroupRef(
  language: Language,
  groupKind: GroupKind,
  groupId: string,
): Promise<ResolvedGroupItem | null> {
  const group = await getGroupByKind(language, groupKind, groupId);
  if (!group) return null;
  return {
    kind: "group",
    itemId: `group:${language}:${groupKind}:${groupId}`,
    language,
    groupKind,
    groupId,
    reading: group.reading,
    rootCount: group.roots.length,
    wordCount: wordCount(group),
    href: `${groupKindBasePath(groupKind)}/${language}/${groupId}`,
  };
}

async function resolveWordRef(
  language: Language,
  groupKind: GroupKind,
  groupId: string,
  wordId: string,
): Promise<ResolvedWordItem | null> {
  const group = await getGroupByKind(language, groupKind, groupId);
  if (!group) return null;
  for (const root of group.roots) {
    const word = flattenWords(root.words).find((w) => w.id === wordId);
    if (word) {
      return {
        kind: "word",
        itemId: `word:${language}:${groupKind}:${groupId}:${wordId}`,
        language,
        groupKind,
        groupId,
        wordId,
        headword: word.headword,
        reading: word.reading,
        meaningVn: word.meaningVn,
        href: `${groupKindBasePath(groupKind)}/${language}/${groupId}`,
      };
    }
  }
  return null;
}

export async function getFavoriteGroupsView(): Promise<ResolvedGroupItem[]> {
  const collections = await loadPersonalCollections();
  const resolved: (ResolvedGroupItem | null)[] = await Promise.all(
    collections.favorites.map(async (f): Promise<ResolvedGroupItem | null> => {
      const item = await resolveGroupRef(f.language, f.groupKind, f.groupId);
      return item ? { ...item, savedAt: f.savedAt } : null;
    }),
  );
  return resolved
    .filter((r): r is ResolvedGroupItem => r !== null)
    .sort((a, b) => (b.savedAt ?? "").localeCompare(a.savedAt ?? ""));
}

export async function getPersonalListsView(): Promise<ResolvedList[]> {
  const collections = await loadPersonalCollections();
  return Promise.all(
    collections.lists.map(async (list) => {
      const resolved: (ResolvedItem | null)[] = await Promise.all(
        list.itemIds.map((itemId): Promise<ResolvedItem | null> => {
          const decoded = decodeItemId(itemId);
          if (!decoded) return Promise.resolve(null);
          if (decoded.type === "group") {
            return resolveGroupRef(decoded.language, decoded.groupKind, decoded.groupId);
          }
          return resolveWordRef(decoded.language, decoded.groupKind, decoded.groupId, decoded.wordId);
        }),
      );
      const items = resolved.filter((r): r is ResolvedItem => r !== null);
      return {
        id: list.id,
        name: list.name,
        createdAt: list.createdAt,
        items,
        unresolvedCount: list.itemIds.length - items.length,
      };
    }),
  );
}

export { groupKindLabel };
