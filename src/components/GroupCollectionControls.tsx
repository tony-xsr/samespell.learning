"use client";

import { useEffect, useState } from "react";
import type { GroupKind, Language } from "@/types/vocab";
import type { PersonalCollections } from "@/types/personal";
import { encodeGroupItemId, favoriteKey } from "@/types/personal";
import { loadPersonalCollections, toggleFavoriteGroup } from "@/lib/personalCollections";
import ListMembershipPicker from "@/components/ListMembershipPicker";

/** Nút "★ yêu thích" + "🗂️ thêm vào danh mục" ở cấp TOÀN BỘ 1 mindmap (group) — khác hẳn
 * FavoriteBadge trong MindmapCanvas (đó là cấp TỪNG TỪ, dùng cho deck ôn SRS). Xem Features.md
 * mục 14.3. Dùng chung cho cả 4 trục nhầm lẫn (sound/shape/false-friend/initial) vì được gắn ngay
 * trong GroupExplorer.tsx — nơi cả 4 route (`/[lang]`, `/shapes`, `/false-friends`, `/initials`) đều
 * render qua chung 1 component. */
export default function GroupCollectionControls({
  language,
  groupKind,
  groupId,
}: {
  language: Language;
  groupKind: GroupKind;
  groupId: string;
}) {
  const [collections, setCollections] = useState<PersonalCollections | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadPersonalCollections().then((c) => {
      if (!cancelled) setCollections(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const key = favoriteKey(language, groupKind, groupId);
  const itemId = encodeGroupItemId(language, groupKind, groupId);
  const isFavorited = collections?.favorites.some((f) => f.key === key) ?? false;

  async function handleToggleFavorite() {
    setError(null);
    try {
      setCollections(await toggleFavoriteGroup(language, groupKind, groupId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleToggleFavorite}
        aria-label={isFavorited ? "Bỏ yêu thích mindmap này" : "Lưu mindmap này vào yêu thích"}
        className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm shadow-sm ${
          isFavorited
            ? "border-amber-400 bg-amber-100 text-amber-600"
            : "border-border bg-surface-2 text-ink-muted hover:bg-surface-3"
        }`}
      >
        {isFavorited ? "★" : "☆"}
      </button>

      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex h-9 items-center gap-1 rounded-full border border-border bg-surface-2 px-3 text-xs font-medium text-ink-muted hover:bg-surface-3"
        >
          🗂️ Danh mục
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
            <div className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-border-strong bg-surface-2 p-3 shadow-xl">
              <ListMembershipPicker itemId={itemId} collections={collections} onUpdate={setCollections} />
            </div>
          </>
        )}
      </div>

      {error && (
        <p className="absolute top-full right-0 mt-1 w-56 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
