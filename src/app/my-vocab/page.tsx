import { loadNewVocabLog } from "@/lib/newVocabLog";
import { getFavoriteGroupsView, getPersonalListsView } from "@/lib/personalCollectionsView";
import { getLanguages } from "@/lib/vocabStore";
import MyVocabView from "@/components/MyVocabView";
import type { Language } from "@/types/vocab";

export default async function MyVocabPage() {
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
    />
  );
}
