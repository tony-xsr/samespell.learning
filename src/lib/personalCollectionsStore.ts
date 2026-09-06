import "server-only";
import type { GroupKind, Language } from "@/types/vocab";
import type { FavoriteGroupRef, PersonalCollections, PersonalList } from "@/types/personal";
import { favoriteKey } from "@/types/personal";
import { kvGet, kvSet } from "@/lib/kv";
import { genId } from "@/lib/id";

const KV_KEY = "personal:collections";

function emptyCollections(): PersonalCollections {
  return { favorites: [], lists: [] };
}

export async function loadPersonalCollections(): Promise<PersonalCollections> {
  try {
    const data = await kvGet<Partial<PersonalCollections>>(KV_KEY);
    return { favorites: data?.favorites ?? [], lists: data?.lists ?? [] };
  } catch {
    // KV chưa cấu hình (vd chạy local chưa có Upstash) — coi như chưa có gì được lưu.
    return emptyCollections();
  }
}

async function save(collections: PersonalCollections): Promise<void> {
  await kvSet(KV_KEY, collections);
}

/** Bật/tắt yêu thích cho CẢ 1 mindmap (group), không phải từng từ — xem Features.md mục 14.3. */
export async function toggleFavoriteGroupServer(
  language: Language,
  groupKind: GroupKind,
  groupId: string,
): Promise<PersonalCollections> {
  const collections = await loadPersonalCollections();
  const key = favoriteKey(language, groupKind, groupId);
  const exists = collections.favorites.some((f) => f.key === key);
  const favorites: FavoriteGroupRef[] = exists
    ? collections.favorites.filter((f) => f.key !== key)
    : [...collections.favorites, { key, language, groupKind, groupId, savedAt: new Date().toISOString() }];
  const updated: PersonalCollections = { ...collections, favorites };
  await save(updated);
  return updated;
}

export async function createListServer(name: string): Promise<PersonalCollections> {
  const collections = await loadPersonalCollections();
  const list: PersonalList = {
    id: genId("list"),
    name: name.trim().slice(0, 60),
    itemIds: [],
    createdAt: new Date().toISOString(),
  };
  const updated: PersonalCollections = { ...collections, lists: [...collections.lists, list] };
  await save(updated);
  return updated;
}

export async function renameListServer(listId: string, name: string): Promise<PersonalCollections> {
  const collections = await loadPersonalCollections();
  const updated: PersonalCollections = {
    ...collections,
    lists: collections.lists.map((l) => (l.id === listId ? { ...l, name: name.trim().slice(0, 60) } : l)),
  };
  await save(updated);
  return updated;
}

export async function deleteListServer(listId: string): Promise<PersonalCollections> {
  const collections = await loadPersonalCollections();
  const updated: PersonalCollections = {
    ...collections,
    lists: collections.lists.filter((l) => l.id !== listId),
  };
  await save(updated);
  return updated;
}

export async function addItemToListServer(listId: string, itemId: string): Promise<PersonalCollections> {
  const collections = await loadPersonalCollections();
  const updated: PersonalCollections = {
    ...collections,
    lists: collections.lists.map((l) =>
      l.id === listId && !l.itemIds.includes(itemId) ? { ...l, itemIds: [...l.itemIds, itemId] } : l,
    ),
  };
  await save(updated);
  return updated;
}

export async function removeItemFromListServer(listId: string, itemId: string): Promise<PersonalCollections> {
  const collections = await loadPersonalCollections();
  const updated: PersonalCollections = {
    ...collections,
    lists: collections.lists.map((l) =>
      l.id === listId ? { ...l, itemIds: l.itemIds.filter((id) => id !== itemId) } : l,
    ),
  };
  await save(updated);
  return updated;
}
