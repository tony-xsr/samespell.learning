import type { Language, ProgressStore, SoundGroup, VocabWord } from "@/types/vocab";
import { flattenWords } from "@/lib/wordTree";

export interface CardInfo {
  word: VocabWord;
  language: Language;
  groupId: string;
  groupReading: string;
  rootChar: string;
  rootHanViet?: string;
  rootMeaning: string;
  siblings: { character: string; meaningVn: string }[];
  bookmarked: boolean;
}

export function buildCardsFromGroup(group: SoundGroup, progress: ProgressStore): CardInfo[] {
  return group.roots.flatMap((root) =>
    flattenWords(root.words).map((word) => ({
      word,
      language: group.language,
      groupId: group.id,
      groupReading: group.reading,
      rootChar: root.character,
      rootHanViet: root.hanViet,
      rootMeaning: root.meaningVn,
      siblings: group.roots
        .filter((r) => r.id !== root.id)
        .map((r) => ({ character: r.character, meaningVn: r.meaningVn })),
      bookmarked: Boolean(progress[word.id]?.bookmarked),
    })),
  );
}
