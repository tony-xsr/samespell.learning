import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type { Language, LanguageData, RootEntry, SoundGroup, VocabWord } from "@/types/vocab";
import { kvGet, kvSet } from "@/lib/kv";
import { getMnemonicMap } from "@/lib/mnemonicStore";
import { ALL_LANGUAGES } from "@/lib/vocabStore";
import { formatLanguageDataLike } from "@/lib/vocabDataFormat";

interface DynamicAdditions {
  extraWords: Record<string, VocabWord[]>;
  extraRoots: Record<string, RootEntry[]>;
  wordChildren: Record<string, VocabWord[]>;
  extraGroups: SoundGroup[];
}

function emptyAdditions(): DynamicAdditions {
  return { extraWords: {}, extraRoots: {}, wordChildren: {}, extraGroups: [] };
}

function kvKey(lang: Language): string {
  return `vocab:extra:${lang}`;
}

async function loadAdditions(lang: Language): Promise<DynamicAdditions> {
  const data = await kvGet<Partial<DynamicAdditions>>(kvKey(lang));
  return {
    extraWords: data?.extraWords ?? {},
    extraRoots: data?.extraRoots ?? {},
    wordChildren: data?.wordChildren ?? {},
    extraGroups: data?.extraGroups ?? [],
  };
}

/** Gắn children AI sinh thêm (wordChildren) vào 1 từ và toàn bộ hậu duệ hiện có của nó, bỏ qua
 * id nào đã có sẵn trong children (tránh trùng nếu lỡ chạy sync 2 lần trước khi KV được xoá). */
function attachWordChildren(word: VocabWord, wordChildren: Record<string, VocabWord[]>): VocabWord {
  const ownChildren = (word.children ?? []).map((c) => attachWordChildren(c, wordChildren));
  const existingIds = new Set(ownChildren.map((c) => c.id));
  const addedChildren = (wordChildren[word.id] ?? [])
    .filter((c) => !existingIds.has(c.id))
    .map((c) => attachWordChildren(c, wordChildren));
  const allChildren = [...ownChildren, ...addedChildren];
  return allChildren.length > 0 ? { ...word, children: allChildren } : word;
}

function mergeGroupPermanently(group: SoundGroup, additions: DynamicAdditions): { group: SoundGroup; addedWords: number; addedRoots: number } {
  let addedWords = 0;
  let addedRoots = 0;
  const roots = group.roots.map((root) => {
    const existingIds = new Set(root.words.map((w) => w.id));
    const extra = (additions.extraWords[root.id] ?? []).filter((w) => !existingIds.has(w.id));
    addedWords += extra.length;
    const words = extra.length > 0 ? [...root.words, ...extra] : root.words;
    return { ...root, words: words.map((w) => attachWordChildren(w, additions.wordChildren)) };
  });
  const existingRootIds = new Set(group.roots.map((r) => r.id));
  const extraRoots = (additions.extraRoots[group.id] ?? [])
    .filter((r) => !existingRootIds.has(r.id))
    .map((root) => ({
      ...root,
      words: root.words.map((w) => attachWordChildren(w, additions.wordChildren)),
    }));
  addedRoots += extraRoots.length;
  return { group: { ...group, roots: [...roots, ...extraRoots] }, addedWords, addedRoots };
}

function applyMnemonicToWord(word: VocabWord, mnemonics: Record<string, string>): VocabWord {
  const withChildren = word.children
    ? { ...word, children: word.children.map((c) => applyMnemonicToWord(c, mnemonics)) }
    : word;
  return mnemonics[word.id] ? { ...withChildren, mnemonicVn: mnemonics[word.id] } : withChildren;
}

export interface SyncResult {
  lang: Language;
  file: string;
  addedWords: number;
  addedRoots: number;
  addedGroups: number;
  skipped: boolean;
}

/** Gộp vĩnh viễn các từ/nhánh AI sinh thêm (đang nằm trong Upstash Redis, key vocab:extra:{lang})
 * vào file data/{lang}.json và data/{lang}-shape.json trên đĩa, rồi xoá phần đã gộp khỏi Redis để
 * tránh bị merge trùng ở lần đọc kế tiếp. Chỉ có tác dụng khi server có quyền ghi filesystem
 * (chạy `next dev` / self-host trên localhost) — không hoạt động trên Vercel (filesystem chỉ đọc). */
export async function syncExtrasToStaticFiles(): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  const dataDir = path.join(process.cwd(), "data");

  for (const lang of ALL_LANGUAGES) {
    const additions = await loadAdditions(lang);
    const hasAnything =
      Object.keys(additions.extraWords).length > 0 ||
      Object.keys(additions.extraRoots).length > 0 ||
      Object.keys(additions.wordChildren).length > 0 ||
      additions.extraGroups.length > 0;
    if (!hasAnything) {
      results.push({ lang, file: `${lang}.json`, addedWords: 0, addedRoots: 0, addedGroups: 0, skipped: true });
      continue;
    }

    const mnemonics = await getMnemonicMap(lang);
    let totalAddedWords = 0;
    let totalAddedRoots = 0;
    let totalAddedGroups = 0;

    for (const suffix of ["", "-shape"] as const) {
      const filename = `${lang}${suffix}.json`;
      const filePath = path.join(dataDir, filename);
      let raw: string;
      try {
        raw = await fs.readFile(filePath, "utf8");
      } catch {
        continue; // ngôn ngữ này không có file nhóm hình (vd. ko-shape.json chưa tồn tại)
      }
      const data = JSON.parse(raw) as LanguageData;

      const mergedGroups = data.groups.map((g) => {
        const { group, addedWords, addedRoots } = mergeGroupPermanently(g, additions);
        totalAddedWords += addedWords;
        totalAddedRoots += addedRoots;
        return {
          ...group,
          roots: group.roots.map((root) => ({
            ...root,
            words: root.words.map((w) => applyMnemonicToWord(w, mnemonics)),
          })),
        };
      });

      // extraGroups là nhóm âm HOÀN TOÀN MỚI (tạo từ ô nhập từ ở trang ngôn ngữ chung) — chỉ gắn
      // vào file nhóm âm chính (suffix ""), không phải file nhóm hình.
      if (suffix === "") {
        const existingGroupIds = new Set(data.groups.map((g) => g.id));
        const newGroups = additions.extraGroups
          .filter((g) => !existingGroupIds.has(g.id))
          .map((g) => {
            const { group } = mergeGroupPermanently(g, additions);
            totalAddedGroups += 1;
            return {
              ...group,
              roots: group.roots.map((root) => ({
                ...root,
                words: root.words.map((w) => applyMnemonicToWord(w, mnemonics)),
              })),
            };
          });
        mergedGroups.push(...newGroups);
      }

      const updated: LanguageData = { ...data, groups: mergedGroups };
      await fs.writeFile(filePath, formatLanguageDataLike(updated, raw), "utf8");
    }

    // Đã ghi vĩnh viễn xuống đĩa — xoá phần extraWords/extraRoots/wordChildren/extraGroups khỏi
    // Redis để lần đọc kế tiếp (getLanguageData/getShapeLanguageData) không merge trùng lần nữa.
    await kvSet(kvKey(lang), emptyAdditions());

    results.push({
      lang,
      file: `${lang}.json`,
      addedWords: totalAddedWords,
      addedRoots: totalAddedRoots,
      addedGroups: totalAddedGroups,
      skipped: false,
    });
  }

  return results;
}
