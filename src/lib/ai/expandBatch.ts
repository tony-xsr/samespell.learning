import "server-only";
import type { Language } from "@/types/vocab";
import { ALL_LANGUAGES, getLanguageData, addExtraWords } from "@/lib/vocabStore";
import { generateStructured } from "@/lib/ai/generate";
import { ExpandRootSchema } from "@/lib/ai/schemas";
import { buildExpandRootPrompt } from "@/lib/ai/prompts";
import { genId } from "@/lib/id";

export interface ExpandBatchAction {
  language: Language;
  groupId: string;
  rootId: string;
  character: string;
  addedWords: number;
}

export interface ExpandBatchResult {
  actions: ExpandBatchAction[];
  totalWordsAdded: number;
  errors: string[];
}

const MIN_WORDS_PER_ROOT = 5;
const MAX_ADD_PER_ROOT = 3;

export async function runExpandBatch(options: {
  language?: Language;
  maxActions?: number;
}): Promise<ExpandBatchResult> {
  const languages = options.language ? [options.language] : ALL_LANGUAGES;
  const maxActions = options.maxActions ?? 5;

  const actions: ExpandBatchAction[] = [];
  const errors: string[] = [];
  let attempts = 0;

  langLoop: for (const lang of languages) {
    const data = await getLanguageData(lang);
    if (!data) continue;
    for (const group of data.groups) {
      for (const root of group.roots) {
        if (attempts >= maxActions) break langLoop;
        if (root.words.length >= MIN_WORDS_PER_ROOT) continue;

        attempts += 1;
        const count = Math.min(MAX_ADD_PER_ROOT, MIN_WORDS_PER_ROOT - root.words.length);
        try {
          const prompt = buildExpandRootPrompt({
            language: lang,
            character: root.character,
            hanViet: root.hanViet,
            meaningVn: root.meaningVn,
            existingHeadwords: root.words.map((w) => w.headword),
            count,
          });
          const result = await generateStructured(ExpandRootSchema, prompt);
          const words = result.words.map((w) => ({ ...w, id: genId("word") }));
          await addExtraWords(lang, root.id, words);
          actions.push({
            language: lang,
            groupId: group.id,
            rootId: root.id,
            character: root.character,
            addedWords: words.length,
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : "lỗi";
          errors.push(`${lang}/${group.id}/${root.character}: ${message}`);
          if (message.startsWith("Chưa cấu hình API key")) break langLoop;
        }
      }
    }
  }

  return {
    actions,
    totalWordsAdded: actions.reduce((sum, a) => sum + a.addedWords, 0),
    errors,
  };
}
