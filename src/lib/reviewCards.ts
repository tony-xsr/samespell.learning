import type { Language, ProgressStore, SoundGroup, VocabWord } from "@/types/vocab";
import type { TopicGroup } from "@/types/topic";
import { flattenWords } from "@/lib/wordTree";

export interface CardInfo {
  word: VocabWord;
  language: Language;
  groupId: string;
  groupReading?: string;
  rootChar?: string;
  rootHanViet?: string;
  rootMeaning?: string;
  /** Nhãn hiển thị trước rootChar ở footer thẻ — mặc định "Gốc" (trục đồng âm/hình/bẫy nghĩa), đổi
   * thành "Nhánh" cho thẻ đến từ mindmap chủ đề (xem buildCardsFromTopic) vì ở đó không có khái niệm
   * "chữ gốc" mà chỉ có nhánh chủ đề chứa từ. */
  contextLabel?: string;
  siblings: { character: string; meaningVn: string }[];
  bookmarked: boolean;
  mastered: boolean;
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
      mastered: Boolean(progress[word.id]?.mastered),
    })),
  );
}

/** Tương tự `buildCardsFromGroup` nhưng cho dữ liệu mindmap chủ đề (`TopicGroup`) — tổ chức theo
 * nhánh chủ đề thay vì chữ gốc đồng âm, nên không có `rootHanViet`/siblings; dùng tên nhánh
 * (`titleNative`/`titleVn`) thay cho "Gốc" ở footer thẻ (xem `contextLabel`). */
export function buildCardsFromTopic(topic: TopicGroup, progress: ProgressStore): CardInfo[] {
  return topic.branches.flatMap((branch) =>
    flattenWords(branch.words).map((word) => ({
      word,
      language: topic.language,
      groupId: branch.id,
      rootChar: branch.titleNative,
      rootMeaning: branch.titleVn,
      contextLabel: "Nhánh",
      siblings: [],
      bookmarked: Boolean(progress[word.id]?.bookmarked),
      mastered: Boolean(progress[word.id]?.mastered),
    })),
  );
}
