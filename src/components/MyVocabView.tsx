"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Language } from "@/types/vocab";
import { groupKindLabel } from "@/types/personal";
import type { NewVocabEntry } from "@/lib/newVocabLog";
import AnswerCardView from "@/components/AnswerCardView";
import MyVocabAiAdd from "@/components/MyVocabAiAdd";
import type { ResolvedGroupItem, ResolvedItem, ResolvedList } from "@/lib/personalCollectionsView";
import {
  createList,
  deleteList,
  removeItemFromList,
  renameList,
  toggleFavoriteGroup,
} from "@/lib/personalCollections";

const LANG_LABEL: Record<Language, string> = {
  zh: "Tiếng Trung",
  ko: "Tiếng Hàn",
  ja: "Tiếng Nhật",
  en: "Tiếng Anh",
};

type Tab = "new" | "favorites" | "lists";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function GroupItemCard({
  item,
  onRemove,
}: {
  item: ResolvedGroupItem;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3 shadow-sm">
      <Link href={item.href} className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-base font-bold text-brand-600">{item.reading}</span>
          <span className="shrink-0 rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-medium text-ink-muted">
            {groupKindLabel(item.groupKind)}
          </span>
        </div>
        <div className="mt-0.5 text-xs text-ink-muted">
          {LANG_LABEL[item.language]} · {item.rootCount} chữ · {item.wordCount} từ
        </div>
      </Link>
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label="Bỏ khỏi danh sách"
          className="shrink-0 rounded-full border border-border bg-surface-3 px-2.5 py-1 text-xs text-ink-muted hover:bg-surface"
        >
          ✕
        </button>
      )}
    </div>
  );
}

/** Thẻ hiển thị 1 TỪ đơn lẻ trong danh mục cá nhân (khác GroupItemCard — cả 1 mindmap). */
function WordItemCard({
  item,
  onRemove,
}: {
  item: Extract<ResolvedItem, { kind: "word" }>;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3 shadow-sm">
      <Link href={item.href} className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-base font-bold text-brand-600">{item.headword}</span>
          <span className="shrink-0 text-xs text-ink-muted italic">{item.reading}</span>
        </div>
        <div className="mt-0.5 text-xs text-ink-muted">
          {LANG_LABEL[item.language]} · {item.meaningVn}
        </div>
      </Link>
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label="Bỏ khỏi danh sách"
          className="shrink-0 rounded-full border border-border bg-surface-3 px-2.5 py-1 text-xs text-ink-muted hover:bg-surface"
        >
          ✕
        </button>
      )}
    </div>
  );
}

function ResolvedItemCard({ item, onRemove }: { item: ResolvedItem; onRemove?: () => void }) {
  return item.kind === "group" ? (
    <GroupItemCard item={item} onRemove={onRemove} />
  ) : (
    <WordItemCard item={item} onRemove={onRemove} />
  );
}

export default function MyVocabView({
  initialNewVocab,
  initialFavorites,
  initialLists,
  readingsByLang,
}: {
  initialNewVocab: NewVocabEntry[];
  initialFavorites: ResolvedGroupItem[];
  initialLists: ResolvedList[];
  readingsByLang: Partial<Record<Language, string[]>>;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("new");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newListName, setNewListName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setBusy(false);
    }
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "new", label: "✨ Mới thêm", count: initialNewVocab.length },
    { key: "favorites", label: "★ Yêu thích", count: initialFavorites.length },
    { key: "lists", label: "🗂️ Danh mục của tôi", count: initialLists.length },
  ];

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-4xl">
        <Link href="/" className="text-sm font-medium text-brand-600 hover:underline">
          ← Trang chủ
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">📚 Từ vựng của tôi</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Từ mới AI vừa giải thích, mindmap đã lưu yêu thích, và danh mục tự tổ chức của riêng bạn.
        </p>

        <div className="mt-5">
          <MyVocabAiAdd readingsByLang={readingsByLang} />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                tab === t.key
                  ? "bg-gradient-to-r from-brand-600 to-accent-500 text-white shadow-md"
                  : "border border-border bg-surface-2 text-ink-muted hover:bg-surface-3"
              }`}
            >
              {t.label} <span className="opacity-80">({t.count})</span>
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        {tab === "new" && (
          <div className="mt-5 space-y-2">
            {initialNewVocab.length === 0 ? (
              <p className="text-sm text-ink-muted">
                Chưa có từ nào — gõ 1 từ vào ô &ldquo;✨ Thêm / phân tích từ vựng bằng AI&rdquo; ở trên.
              </p>
            ) : (
              initialNewVocab.map((entry) =>
                entry.groupId ? (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3 shadow-sm"
                  >
                    <Link href={`/${entry.language}/${entry.groupId}`} className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-base font-bold text-brand-600">{entry.word}</span>
                        <span className="shrink-0 rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-medium text-ink-muted">
                          {LANG_LABEL[entry.language]} · {entry.theme}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-ink-muted">{entry.note}</div>
                    </Link>
                    <span className="shrink-0 text-xs text-ink-muted">{formatDate(entry.createdAt)}</span>
                  </div>
                ) : (
                  <div key={entry.id} className="rounded-xl border border-border bg-surface-2 px-4 py-3 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-medium text-ink-muted">
                        {LANG_LABEL[entry.language]} · {entry.theme}
                      </span>
                      <span className="shrink-0 text-xs text-ink-muted">{formatDate(entry.createdAt)}</span>
                    </div>
                    {entry.card && (
                      <div className="mt-2">
                        <AnswerCardView theme={entry.theme} card={entry.card} />
                      </div>
                    )}
                  </div>
                ),
              )
            )}
          </div>
        )}

        {tab === "favorites" && (
          <div className="mt-5 space-y-2">
            {initialFavorites.length === 0 ? (
              <p className="text-sm text-ink-muted">
                Chưa lưu mindmap nào — mở 1 mindmap bất kỳ rồi bấm nút ☆ cạnh &ldquo;Ôn tập nhóm này&rdquo;.
              </p>
            ) : (
              initialFavorites.map((item) => (
                <GroupItemCard
                  key={item.itemId}
                  item={item}
                  onRemove={() =>
                    withBusy(async () => {
                      await toggleFavoriteGroup(item.language, item.groupKind, item.groupId);
                    })
                  }
                />
              ))
            )}
          </div>
        )}

        {tab === "lists" && (
          <div className="mt-5 space-y-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newListName.trim() || busy) return;
                withBusy(async () => {
                  await createList(newListName.trim());
                  setNewListName("");
                });
              }}
              className="flex gap-2 rounded-2xl border border-dashed border-accent-400 bg-surface-2 p-3"
            >
              <input
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="Tên danh mục mới, vd: Từ khó nhớ, Ôn thi HSK4…"
                disabled={busy}
                className="flex-1 rounded-full border border-border bg-surface px-4 py-2 text-sm text-ink outline-none focus:border-brand-400 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={busy || !newListName.trim()}
                className="rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:brightness-105 disabled:opacity-50"
              >
                + Tạo danh mục
              </button>
            </form>

            {initialLists.length === 0 ? (
              <p className="text-sm text-ink-muted">
                Chưa có danh mục nào — tạo 1 danh mục ở trên, hoặc bấm &ldquo;🗂️ Danh mục&rdquo; ngay trên
                trang 1 mindmap để thêm nó vào danh mục mới.
              </p>
            ) : (
              initialLists.map((list) => (
                <div key={list.id} className="rounded-2xl border border-border bg-surface-2 p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {renamingId === list.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!renameValue.trim() || busy) return;
                          withBusy(async () => {
                            await renameList(list.id, renameValue.trim());
                            setRenamingId(null);
                          });
                        }}
                        className="flex flex-1 gap-1.5"
                      >
                        <input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          autoFocus
                          className="flex-1 rounded-full border border-border bg-surface px-3 py-1 text-sm text-ink outline-none focus:border-brand-400"
                        />
                        <button
                          type="submit"
                          className="rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700"
                        >
                          Lưu
                        </button>
                        <button
                          type="button"
                          onClick={() => setRenamingId(null)}
                          className="rounded-full border border-border px-3 py-1 text-xs text-ink-muted hover:bg-surface-3"
                        >
                          Huỷ
                        </button>
                      </form>
                    ) : (
                      <h2 className="text-lg font-bold text-ink">
                        {list.name} <span className="text-sm font-normal text-ink-muted">({list.items.length})</span>
                      </h2>
                    )}
                    {renamingId !== list.id && (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => {
                            setRenamingId(list.id);
                            setRenameValue(list.name);
                          }}
                          className="rounded-full border border-border bg-surface-3 px-2.5 py-1 text-xs text-ink-muted hover:bg-surface"
                        >
                          ✏️ Đổi tên
                        </button>
                        <button
                          onClick={() => withBusy(async () => { await deleteList(list.id); })}
                          className="rounded-full border border-border bg-surface-3 px-2.5 py-1 text-xs text-red-600 hover:bg-surface dark:text-red-400"
                        >
                          🗑️ Xoá
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 space-y-2">
                    {list.items.length === 0 ? (
                      <p className="text-xs text-ink-muted">
                        Chưa có gì trong danh mục này — mở 1 mindmap hoặc 1 từ và bấm &ldquo;🗂️ Danh
                        mục&rdquo; để thêm.
                      </p>
                    ) : (
                      list.items.map((item) => (
                        <ResolvedItemCard
                          key={item.itemId}
                          item={item}
                          onRemove={() =>
                            withBusy(async () => {
                              await removeItemFromList(list.id, item.itemId);
                            })
                          }
                        />
                      ))
                    )}
                    {list.unresolvedCount > 0 && (
                      <p className="text-xs text-ink-muted">
                        +{list.unresolvedCount} mục không hiển thị được (đã bị xoá hoặc chưa hỗ trợ).
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </main>
  );
}
