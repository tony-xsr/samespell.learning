import { loadNewVocabLog } from "@/lib/newVocabLog";
import { getFavoriteGroupsView, getPersonalListsView } from "@/lib/personalCollectionsView";
import MyVocabView from "@/components/MyVocabView";

export default async function MyVocabPage() {
  const [newVocabEntries, favorites, lists] = await Promise.all([
    loadNewVocabLog(),
    getFavoriteGroupsView(),
    getPersonalListsView(),
  ]);

  return (
    <MyVocabView
      initialNewVocab={newVocabEntries}
      initialFavorites={favorites}
      initialLists={lists}
    />
  );
}
