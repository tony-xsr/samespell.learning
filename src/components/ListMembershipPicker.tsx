"use client";

import { useState } from "react";
import type { PersonalCollections } from "@/types/personal";
import { addItemToList, createList, removeItemFromList } from "@/lib/personalCollections";

/** Danh sách checkbox "thuộc danh mục nào" + form tạo nhanh 1 danh mục mới — dùng chung cho cả
 * mindmap (GroupCollectionControls.tsx) lẫn từng từ đơn lẻ (MindmapCanvas.tsx), vì cả 2 chỉ khác
 * nhau ở `itemId` truyền vào (encodeGroupItemId/encodeWordItemId, xem types/personal.ts). */
export default function ListMembershipPicker({
  itemId,
  collections,
  onUpdate,
}: {
  itemId: string;
  collections: PersonalCollections | null;
  onUpdate: (c: PersonalCollections) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newListName, setNewListName] = useState("");

  async function toggleMembership(listId: string, alreadyIn: boolean) {
    setBusy(true);
    setError(null);
    try {
      const updated = alreadyIn
        ? await removeItemFromList(listId, itemId)
        : await addItemToList(listId, itemId);
      onUpdate(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newListName.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await createList(newListName.trim());
      const created = updated.lists[updated.lists.length - 1];
      const withItem = created ? await addItemToList(created.id, itemId) : updated;
      onUpdate(withItem);
      setNewListName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-left">
      {collections && collections.lists.length > 0 ? (
        <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
          {collections.lists.map((l) => {
            const inList = l.itemIds.includes(itemId);
            return (
              <li key={l.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 hover:bg-surface-3">
                  <input
                    type="checkbox"
                    checked={inList}
                    disabled={busy}
                    onChange={() => toggleMembership(l.id, inList)}
                  />
                  <span className="flex-1 truncate text-ink">{l.name}</span>
                  <span className="text-xs text-ink-muted">{l.itemIds.length}</span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-ink-muted">Chưa có danh mục nào.</p>
      )}
      <form onSubmit={handleCreate} className="mt-2 flex gap-1.5 border-t border-border pt-2">
        <input
          value={newListName}
          onChange={(e) => setNewListName(e.target.value)}
          placeholder="Tên danh mục mới…"
          disabled={busy}
          className="flex-1 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-ink outline-none focus:border-brand-400 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || !newListName.trim()}
          className="rounded-full bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          +
        </button>
      </form>
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
