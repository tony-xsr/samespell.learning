import type { SoundGroup } from "@/types/vocab";
import type { TopicGroup } from "@/types/topic";
import { flattenWords } from "@/lib/wordTree";
import type { MatchItem } from "@/components/mindmap/MeaningMatchGame";

/** Một NHÁNH của mindmap đã làm phẳng: chữ gốc (mindmap âm/hình) hoặc nhóm con (mindmap chủ đề), kèm
 * các từ thuộc nhánh đó.
 *
 * `matchItemsFromGroup`/`matchItemsFromTopic` trả về danh sách PHẲNG — đủ cho trò ghép nghĩa và bảng
 * danh sách, nhưng mất cấu trúc nhánh. Chế độ "Tập trung" (học từng nhánh một) và "Trang giấy" (mỗi
 * nhánh là một mục trong trang) đều cần đúng cấu trúc đó, nên trích riêng ở đây thay vì để mỗi màn
 * tự dò lại `group.roots` / `topic.branches` theo cách riêng rồi lệch nhau.
 */
export interface StudyBranch {
  id: string;
  /** Tiêu đề nhánh bằng tiếng gốc — chữ gốc, hoặc tên nhánh chủ đề. */
  title: string;
  /** Nghĩa tiếng Việt của tiêu đề nhánh. */
  subtitle: string;
  reading?: string;
  hanViet?: string;
  words: MatchItem[];
}

function wordToItem(w: ReturnType<typeof flattenWords>[number]): MatchItem {
  return {
    id: w.id,
    headword: w.headword,
    reading: w.reading,
    meaningVn: w.meaningVn,
    hanViet: w.hanViet,
    example: w.example,
    userAdded: w.source === "user",
    wordClass: w.wordClass,
    level: w.level,
    mnemonicVn: w.mnemonicVn,
  };
}

export function branchesFromGroup(group: SoundGroup): StudyBranch[] {
  return group.roots.map((root) => ({
    id: root.id,
    title: root.character,
    subtitle: root.meaningVn,
    reading: root.reading,
    hanViet: root.hanViet,
    words: flattenWords(root.words).map(wordToItem),
  }));
}

export function branchesFromTopic(topic: TopicGroup): StudyBranch[] {
  return topic.branches.map((br) => ({
    id: br.id,
    title: br.titleNative,
    subtitle: br.titleVn,
    words: flattenWords(br.words).map(wordToItem),
  }));
}

/** Tổng số ô phải nhớ trong cả mindmap (tiêu đề nhánh cũng là một ô), để hiện tiến độ. */
export function countStudyCells(branches: StudyBranch[]): number {
  return branches.reduce((sum, b) => sum + 1 + b.words.length, 0);
}
