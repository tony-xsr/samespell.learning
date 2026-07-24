import "server-only";
import type { Language, LanguageData, RootEntry, SoundGroup, VocabWord } from "@/types/vocab";
import { kvGet, kvSet } from "@/lib/kv";
import { getMnemonicMap } from "@/lib/mnemonicStore";
import { flattenWords } from "@/lib/wordTree";
import zh from "../../data/zh.json";
import ko from "../../data/ko.json";
import ja from "../../data/ja.json";

const STATIC_DATA: Record<Language, LanguageData> = {
  zh: zh as LanguageData,
  ko: ko as LanguageData,
  ja: ja as LanguageData,
};

const ALL_LANGUAGES: Language[] = ["zh", "ko", "ja"];

interface DynamicAdditions {
  extraWords: Record<string, VocabWord[]>;
  extraRoots: Record<string, RootEntry[]>;
  wordChildren: Record<string, VocabWord[]>;
}

function emptyAdditions(): DynamicAdditions {
  return { extraWords: {}, extraRoots: {}, wordChildren: {} };
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
  return {
    ...staticData,
    groups: staticData.groups.map((g) => applyMnemonics(mergeGroup(g, additions), mnemonics)),
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

export function getAllWordsInGroup(group: SoundGroup): VocabWord[] {
  return group.roots.flatMap((r) => flattenWords(r.words));
}

export function wordCount(group: SoundGroup): number {
  return getAllWordsInGroup(group).length;
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

export { STATIC_DATA, ALL_LANGUAGES };
