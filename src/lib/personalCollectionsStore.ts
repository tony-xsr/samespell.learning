import "server-only";
import type { GroupKind, Language } from "@/types/vocab";
import { MAX_REST_DAYS } from "@/lib/dailyRitual";
import type {
  FavoriteGroupRef,
  LearnedGroupRef,
  PersonalCollections,
  PersonalList,
} from "@/types/personal";
import { favoriteKey } from "@/types/personal";
import { kvGet, kvSet } from "@/lib/kv";
import { genId } from "@/lib/id";

const KV_KEY = "personal:collections";

function emptyCollections(): PersonalCollections {
  return { favorites: [], lists: [], learned: [], ritual: { restDays: [] } };
}

export async function loadPersonalCollections(): Promise<PersonalCollections> {
  try {
    const data = await kvGet<Partial<PersonalCollections>>(KV_KEY);
    // `learned` mặc định [] để dữ liệu lưu từ trước mục 22 vẫn đọc được bình thường.
    return {
      favorites: data?.favorites ?? [],
      lists: data?.lists ?? [],
      learned: data?.learned ?? [],
      ritual: { restDays: data?.ritual?.restDays ?? [] },
    };
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

/** Tập khoá các mindmap đã đánh dấu "đã học" của 1 ngôn ngữ+trục — để trang DANH SÁCH nhóm gắn dấu
 * mà không phải gọi KV nhiều lần. Trả Set rỗng nếu KV chưa cấu hình. */
export async function loadLearnedKeySet(
  // `string` chứ không phải `Language` để khớp các loader cùng chỗ gọi (getShapeLanguageData...),
  // vốn nhận thẳng param động của route rồi mới tự thu hẹp kiểu bên trong.
  language: string,
  groupKind: GroupKind,
): Promise<Set<string>> {
  const { learned = [] } = await loadPersonalCollections();
  return new Set(
    learned.filter((l) => l.language === language && l.groupKind === groupKind).map((l) => l.groupId),
  );
}

/** Bật/tắt "đã học xong" cho CẢ 1 mindmap. Khác `toggleMasteredWord` (cấp từng từ, ảnh hưởng SRS):
 * cái này không đụng gì tới lịch ôn tập, chỉ là dấu mốc của người học + nguồn cho trang "Đã học". */
export async function toggleLearnedGroupServer(
  language: Language,
  groupKind: GroupKind,
  groupId: string,
): Promise<PersonalCollections> {
  const collections = await loadPersonalCollections();
  const key = favoriteKey(language, groupKind, groupId);
  const current = collections.learned ?? [];
  const exists = current.some((l) => l.key === key);
  const learned: LearnedGroupRef[] = exists
    ? current.filter((l) => l.key !== key)
    : [...current, { key, language, groupKind, groupId, learnedAt: new Date().toISOString() }];
  const updated: PersonalCollections = { ...collections, learned };
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

/** Lưu ngày nghỉ của nghi thức hàng ngày. Lọc sạch đầu vào ngay tại đây (chỉ 0–6, bỏ trùng, cắt còn
 * MAX_REST_DAYS) để dữ liệu hỏng không bao giờ lọt vào KV dù route gọi sai. */
export async function saveRestDaysServer(restDays: number[]): Promise<PersonalCollections> {
  const clean = [...new Set(restDays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))]
    .sort()
    .slice(0, MAX_REST_DAYS);
  const collections = await loadPersonalCollections();
  const updated: PersonalCollections = { ...collections, ritual: { restDays: clean } };
  await save(updated);
  return updated;
}
