import { loadNewVocabLog } from "@/lib/newVocabLog";
import { getFavoriteGroupsView, getPersonalListsView } from "@/lib/personalCollectionsView";
import { getLanguages } from "@/lib/vocabStore";
import MyVocabView from "@/components/MyVocabView";
import type { Language } from "@/types/vocab";

const AI_LANGS: Language[] = ["zh", "ko", "ja", "en", "es"];

export default async function MyVocabPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // /my-vocab?ai=…&lang=… — đến từ bảng Tra nhanh khi kho chưa có từ: điền sẵn ô "thêm bằng AI"
  const { ai, lang } = await searchParams;
  const aiPrefill =
    typeof ai === "string" && ai.trim()
      ? { text: ai.trim().slice(0, 60), lang: AI_LANGS.find((l) => l === lang) ?? ("zh" as Language) }
      : undefined;
  const [newVocabEntries, favorites, lists, languages] = await Promise.all([
    loadNewVocabLog(),
    getFavoriteGroupsView(),
    getPersonalListsView(),
    getLanguages(),
  ]);

  // Cách đọc hiện có theo từng ngôn ngữ — để AI biết nhóm đồng âm nào đã tồn tại mà gộp chung.
  const readingsByLang: Partial<Record<Language, string[]>> = {};
  for (const data of languages) {
    readingsByLang[data.language] = data.groups.map((g) => g.reading);
  }

  return (
    <MyVocabView
      initialNewVocab={newVocabEntries}
      initialFavorites={favorites}
      initialLists={lists}
      readingsByLang={readingsByLang}
      aiPrefill={aiPrefill}
    />
  );
}
