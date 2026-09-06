import "server-only";
import type { Language, RootEntry, SoundGroup } from "@/types/vocab";
import {
  getFalseFriendLanguageData,
  getInitialLanguageData,
  getLanguageData,
  getShapeLanguageData,
} from "@/lib/vocabStore";
import { getTopicLanguageData } from "@/lib/topicStore";
import { flattenWords } from "@/lib/wordTree";
import type { QuizAxisKind, QuizWordEntry } from "@/lib/quiz/types";

function fromGroups(groups: SoundGroup[], axisKind: QuizAxisKind): QuizWordEntry[] {
  const entries: QuizWordEntry[] = [];
  for (const group of groups) {
    for (const root of group.roots as RootEntry[]) {
      for (const word of flattenWords(root.words)) {
        entries.push({
          id: word.id,
          headword: word.headword,
          reading: word.reading,
          meaningVn: word.meaningVn,
          example: word.example,
          exampleVn: word.exampleVn,
          sourceKey: root.id,
          axisKind,
        });
      }
    }
  }
  return entries;
}

/** Gộp toàn bộ nguồn từ vựng có sẵn của 1 ngôn ngữ (trục âm chính + shape/false-friend/initial nếu
 * có + chủ đề mindmap) thành 1 pool phẳng để sinh câu hỏi. Mỗi nguồn được đọc qua đúng hàm store đã
 * có sẵn (tự merge thêm dữ liệu AI-generated từ KV) — KHÔNG đọc thẳng file JSON. */
async function buildVocabPoolUncached(lang: Language): Promise<QuizWordEntry[]> {
  const [main, shape, falseFriend, initial, topics] = await Promise.all([
    getLanguageData(lang),
    getShapeLanguageData(lang),
    getFalseFriendLanguageData(lang),
    getInitialLanguageData(lang),
    Promise.resolve(getTopicLanguageData(lang)),
  ]);

  const entries: QuizWordEntry[] = [
    ...(main ? fromGroups(main.groups, "sound") : []),
    ...(shape ? fromGroups(shape.groups, "shape") : []),
    ...(falseFriend ? fromGroups(falseFriend.groups, "false-friend") : []),
    ...(initial ? fromGroups(initial.groups, "initial") : []),
  ];

  if (topics) {
    for (const topic of topics.topics) {
      for (const branch of topic.branches) {
        for (const word of flattenWords(branch.words)) {
          entries.push({
            id: word.id,
            headword: word.headword,
            reading: word.reading,
            meaningVn: word.meaningVn,
            example: word.example,
            exampleVn: word.exampleVn,
            sourceKey: branch.id,
            axisKind: "topic",
          });
        }
      }
    }
  }

  // Loại trùng theo id (phòng trường hợp 1 từ xuất hiện ở nhiều nguồn) — giữ bản gặp đầu tiên.
  const seen = new Set<string>();
  const deduped: QuizWordEntry[] = [];
  for (const entry of entries) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    deduped.push(entry);
  }
  return deduped;
}

// Cache trong bộ nhớ theo ngôn ngữ trong phạm vi 1 tiến trình server — dữ liệu tĩnh + admin hiếm khi
// đổi nên không cần cơ chế invalidate phức tạp; tránh build lại pool hàng nghìn từ mỗi request.
const poolCache = new Map<Language, Promise<QuizWordEntry[]>>();

export function buildVocabPool(lang: Language): Promise<QuizWordEntry[]> {
  let cached = poolCache.get(lang);
  if (!cached) {
    cached = buildVocabPoolUncached(lang);
    poolCache.set(lang, cached);
  }
  return cached;
}
