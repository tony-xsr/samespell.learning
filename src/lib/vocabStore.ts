import "server-only";
import type { Language, LanguageData, RootEntry, SoundGroup, VocabWord } from "@/types/vocab";
import { kvGet, kvSet } from "@/lib/kv";
import { getMnemonicMap } from "@/lib/mnemonicStore";
import { flattenWords } from "@/lib/wordTree";
import zh from "../../data/zh.json";
import ko from "../../data/ko.json";
import ja from "../../data/ja.json";
import zhShape from "../../data/zh-shape.json";
import jaShape from "../../data/ja-shape.json";
import zhFalseFriends from "../../data/zh-false-friends.json";
import zhInitials from "../../data/zh-initials.json";

const STATIC_DATA: Record<Language, LanguageData> = {
  zh: zh as LanguageData,
  ko: ko as LanguageData,
  ja: ja as LanguageData,
};

// Dữ liệu "nhóm hình" (chữ VIẾT giống nhau, hình cận tự) — trục nhầm lẫn song song với nhóm âm ở
// trên, chỉ khai báo cho ngôn ngữ nào đã có dữ liệu (hiện chưa làm cho tiếng Hàn vì Hangul dễ phân
// biệt hơn chữ Hán/Kanji nhiều, xem readme.md).
const STATIC_SHAPE_DATA: Partial<Record<Language, LanguageData>> = {
  zh: zhShape as LanguageData,
  ja: jaShape as LanguageData,
};

// Dữ liệu "bẫy nghĩa" (1 chữ dùng chung giữa 2+ từ ghép nhưng nghĩa lệch/trôi nhau) — trục nhầm lẫn
// thứ ba, hiện chỉ có cho tiếng Trung (ja/ko chưa viết).
const STATIC_FALSE_FRIEND_DATA: Partial<Record<Language, LanguageData>> = {
  zh: zhFalseFriends as LanguageData,
};

// Dữ liệu "cùng âm đầu pinyin" (chỉ trùng phụ âm đầu, không liên quan âm/nghĩa) — trục nhầm lẫn thứ
// tư, hiện chỉ có cho tiếng Trung (ja/ko chưa viết).
const STATIC_INITIAL_DATA: Partial<Record<Language, LanguageData>> = {
  zh: zhInitials as LanguageData,
};

const ALL_LANGUAGES: Language[] = ["zh", "ko", "ja"];

interface DynamicAdditions {
  extraWords: Record<string, VocabWord[]>;
  extraRoots: Record<string, RootEntry[]>;
  wordChildren: Record<string, VocabWord[]>;
  /** Nhóm âm hoàn toàn mới do người dùng gõ 1 từ trên trang ngôn ngữ chung rồi AI tạo mindmap
   * (xem addExtraGroup) — khác với extraRoots (thêm chữ gốc vào nhóm CÓ SẴN). */
  extraGroups: SoundGroup[];
}

function emptyAdditions(): DynamicAdditions {
  return { extraWords: {}, extraRoots: {}, wordChildren: {}, extraGroups: [] };
}

function kvKey(lang: Language): string {
  return `vocab:extra:${lang}`;
}

async function loadAdditions(lang: Language): Promise<DynamicAdditions> {
  try {
    const data = await kvGet<Partial<DynamicAdditions>>(kvKey(lang));
    return {
      extraWords: data?.extraWords ?? {},
      extraRoots: data?.extraRoots ?? {},
      wordChildren: data?.wordChildren ?? {},
      extraGroups: data?.extraGroups ?? [],
    };
  } catch {
    // KV chưa cấu hình (vd. chạy local chưa có Upstash) — dùng dữ liệu tĩnh, bỏ qua phần mở rộng.
    return emptyAdditions();
  }
}

/** Recursively attaches AI-generated child branches (from `wordChildren`) onto a word and
 * all of its existing descendants, so a child can itself later be expanded further. */
function attachWordChildren(word: VocabWord, wordChildren: Record<string, VocabWord[]>): VocabWord {
  const ownChildren = (word.children ?? []).map((c) => attachWordChildren(c, wordChildren));
  const addedChildren = (wordChildren[word.id] ?? []).map((c) => attachWordChildren(c, wordChildren));
  const allChildren = [...ownChildren, ...addedChildren];
  return allChildren.length > 0 ? { ...word, children: allChildren } : word;
}

function mergeGroup(group: SoundGroup, additions: DynamicAdditions): SoundGroup {
  const roots = group.roots.map((root) => {
    const extra = additions.extraWords[root.id];
    const words = extra && extra.length > 0 ? [...root.words, ...extra] : root.words;
    return { ...root, words: words.map((w) => attachWordChildren(w, additions.wordChildren)) };
  });
  const extraRoots = (additions.extraRoots[group.id] ?? []).map((root) => ({
    ...root,
    words: root.words.map((w) => attachWordChildren(w, additions.wordChildren)),
  }));
  return { ...group, roots: [...roots, ...extraRoots] };
}

function applyMnemonicToWord(word: VocabWord, mnemonics: Record<string, string>): VocabWord {
  const withChildren = word.children
    ? { ...word, children: word.children.map((c) => applyMnemonicToWord(c, mnemonics)) }
    : word;
  return mnemonics[word.id] ? { ...withChildren, mnemonicVn: mnemonics[word.id] } : withChildren;
}

function applyMnemonics(group: SoundGroup, mnemonics: Record<string, string>): SoundGroup {
  if (Object.keys(mnemonics).length === 0) return group;
  return {
    ...group,
    roots: group.roots.map((root) => ({
      ...root,
      words: root.words.map((w) => applyMnemonicToWord(w, mnemonics)),
    })),
  };
}

export async function getLanguageData(lang: string): Promise<LanguageData | undefined> {
  const staticData = STATIC_DATA[lang as Language];
  if (!staticData) return undefined;
  const [additions, mnemonics] = await Promise.all([
    loadAdditions(lang as Language),
    getMnemonicMap(lang as Language),
  ]);
  const staticGroups = staticData.groups.map((g) => applyMnemonics(mergeGroup(g, additions), mnemonics));
  const newGroups = additions.extraGroups.map((g) => applyMnemonics(mergeGroup(g, additions), mnemonics));
  return {
    ...staticData,
    groups: [...staticGroups, ...newGroups],
  };
}

export async function getLanguages(): Promise<LanguageData[]> {
  const results = await Promise.all(ALL_LANGUAGES.map((l) => getLanguageData(l)));
  return results.filter((d): d is LanguageData => !!d);
}

export async function getSoundGroup(lang: string, groupId: string): Promise<SoundGroup | undefined> {
  const data = await getLanguageData(lang);
  return data?.groups.find((g) => g.id === groupId);
}

/** Tương tự getLanguageData nhưng đọc từ dữ liệu "nhóm hình" (groupKind: "shape"). Dùng chung
 * loadAdditions/mergeGroup/applyMnemonics vì rootId/groupId của nhóm hình đã có tiền tố "-shape-"
 * riêng, không đụng namespace với nhóm âm trong cùng 1 KV bucket theo ngôn ngữ. */
export async function getShapeLanguageData(lang: string): Promise<LanguageData | undefined> {
  const staticData = STATIC_SHAPE_DATA[lang as Language];
  if (!staticData) return undefined;
  const [additions, mnemonics] = await Promise.all([
    loadAdditions(lang as Language),
    getMnemonicMap(lang as Language),
  ]);
  return {
    ...staticData,
    groups: staticData.groups.map((g) => applyMnemonics(mergeGroup(g, additions), mnemonics)),
  };
}

export async function getShapeLanguages(): Promise<LanguageData[]> {
  const results = await Promise.all(ALL_LANGUAGES.map((l) => getShapeLanguageData(l)));
  return results.filter((d): d is LanguageData => !!d);
}

export async function getShapeGroup(lang: string, groupId: string): Promise<SoundGroup | undefined> {
  const data = await getShapeLanguageData(lang);
  return data?.groups.find((g) => g.id === groupId);
}

/** Tương tự getLanguageData nhưng đọc từ dữ liệu "bẫy nghĩa" (groupKind: "false-friend"). Dùng chung
 * loadAdditions/mergeGroup/applyMnemonics vì rootId/groupId của nhóm bẫy nghĩa đã có tiền tố "-ff-"
 * riêng, không đụng namespace với nhóm âm/nhóm hình trong cùng 1 KV bucket theo ngôn ngữ. */
export async function getFalseFriendLanguageData(lang: string): Promise<LanguageData | undefined> {
  const staticData = STATIC_FALSE_FRIEND_DATA[lang as Language];
  if (!staticData) return undefined;
  const [additions, mnemonics] = await Promise.all([
    loadAdditions(lang as Language),
    getMnemonicMap(lang as Language),
  ]);
  return {
    ...staticData,
    groups: staticData.groups.map((g) => applyMnemonics(mergeGroup(g, additions), mnemonics)),
  };
}

export async function getFalseFriendLanguages(): Promise<LanguageData[]> {
  const results = await Promise.all(ALL_LANGUAGES.map((l) => getFalseFriendLanguageData(l)));
  return results.filter((d): d is LanguageData => !!d);
}

export async function getFalseFriendGroup(lang: string, groupId: string): Promise<SoundGroup | undefined> {
  const data = await getFalseFriendLanguageData(lang);
  return data?.groups.find((g) => g.id === groupId);
}

/** Tương tự getLanguageData nhưng đọc từ dữ liệu "cùng âm đầu pinyin" (groupKind: "initial"). Dùng
 * chung loadAdditions/mergeGroup/applyMnemonics vì rootId/groupId của nhóm âm đầu đã có tiền tố
 * "-init-" riêng, không đụng namespace với các trục nhầm lẫn khác trong cùng 1 KV bucket theo ngôn ngữ. */
export async function getInitialLanguageData(lang: string): Promise<LanguageData | undefined> {
  const staticData = STATIC_INITIAL_DATA[lang as Language];
  if (!staticData) return undefined;
  const [additions, mnemonics] = await Promise.all([
    loadAdditions(lang as Language),
    getMnemonicMap(lang as Language),
  ]);
  return {
    ...staticData,
    groups: staticData.groups.map((g) => applyMnemonics(mergeGroup(g, additions), mnemonics)),
  };
}

export async function getInitialLanguages(): Promise<LanguageData[]> {
  const results = await Promise.all(ALL_LANGUAGES.map((l) => getInitialLanguageData(l)));
  return results.filter((d): d is LanguageData => !!d);
}

export async function getInitialGroup(lang: string, groupId: string): Promise<SoundGroup | undefined> {
  const data = await getInitialLanguageData(lang);
  return data?.groups.find((g) => g.id === groupId);
}

export function getAllWordsInGroup(group: SoundGroup): VocabWord[] {
  return group.roots.flatMap((r) => flattenWords(r.words));
}

export function wordCount(group: SoundGroup): number {
  return getAllWordsInGroup(group).length;
}

/** Chuẩn hoá cách đọc để so sánh (bỏ khoảng trắng thừa, chuẩn hoá Unicode, không phân biệt hoa/thường)
 * — dùng khi cần kiểm tra 2 nhóm có "cùng 1 âm" hay không trước khi tạo nhóm mới, tránh trùng lặp. */
export function normalizeReading(reading: string): string {
  return reading.trim().normalize("NFC").toLowerCase();
}

/** Tìm nhóm ÂM đã tồn tại (trong dữ liệu đã merge tĩnh + Redis) có cùng cách đọc, để quyết định gộp
 * chữ gốc mới vào nhóm đó (addExtraRoot) thay vì tạo hẳn 1 nhóm mới trùng lặp (addExtraGroup). */
export function findGroupByReading(data: LanguageData, reading: string): SoundGroup | undefined {
  const target = normalizeReading(reading);
  return data.groups.find((g) => normalizeReading(g.reading) === target);
}

export async function addExtraWords(lang: Language, rootId: string, words: VocabWord[]): Promise<void> {
  const additions = await loadAdditions(lang);
  additions.extraWords[rootId] = [...(additions.extraWords[rootId] ?? []), ...words];
  await kvSet(kvKey(lang), additions);
}

export async function addExtraRoot(lang: Language, groupId: string, root: RootEntry): Promise<void> {
  const additions = await loadAdditions(lang);
  additions.extraRoots[groupId] = [...(additions.extraRoots[groupId] ?? []), root];
  await kvSet(kvKey(lang), additions);
}

export async function addWordChildren(lang: Language, wordId: string, children: VocabWord[]): Promise<void> {
  const additions = await loadAdditions(lang);
  additions.wordChildren[wordId] = [...(additions.wordChildren[wordId] ?? []), ...children];
  await kvSet(kvKey(lang), additions);
}

export async function addExtraGroup(lang: Language, group: SoundGroup): Promise<void> {
  const additions = await loadAdditions(lang);
  additions.extraGroups = [...additions.extraGroups, group];
  await kvSet(kvKey(lang), additions);
}

export { STATIC_DATA, ALL_LANGUAGES };
