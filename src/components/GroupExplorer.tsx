"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { RootEntry, SoundGroup, VocabWord } from "@/types/vocab";
import MindmapCanvas from "@/components/mindmap/MindmapCanvas";
import { loadProgress, toggleBookmark } from "@/lib/progress";

function updateWordInList(
  words: VocabWord[],
  wordId: string,
  updater: (w: VocabWord) => VocabWord,
): VocabWord[] {
  return words.map((w) => {
    if (w.id === wordId) return updater(w);
    if (w.children && w.children.length > 0) {
      return { ...w, children: updateWordInList(w.children, wordId, updater) };
    }
    return w;
  });
}

export default function GroupExplorer({
  initialGroup,
  lang,
}: {
  initialGroup: SoundGroup;
  lang: string;
}) {
  const [group, setGroup] = useState(initialGroup);
  const [expandingRoot, setExpandingRoot] = useState<string | null>(null);
  const [findingRoot, setFindingRoot] = useState(false);
  const [mnemonicLoadingId, setMnemonicLoadingId] = useState<string | null>(null);
  const [expandingWordId, setExpandingWordId] = useState<string | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadProgress().then((progress) => {
      if (cancelled) return;
      const ids = Object.entries(progress)
        .filter(([, p]) => p.bookmarked)
        .map(([id]) => id);
      setBookmarkedIds(new Set(ids));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleExpandRoot(root: RootEntry) {
    setError(null);
    setExpandingRoot(root.id);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "expand-root",
          language: group.language,
          groupId: group.id,
          rootId: root.id,
          character: root.character,
          meaningVn: root.meaningVn,
          hanViet: root.hanViet,
          existingHeadwords: root.words.map((w) => w.headword),
          count: 4,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lỗi khi gọi AI");
      setGroup((g) => ({
        ...g,
        roots: g.roots.map((r) =>
          r.id === root.id ? { ...r, words: [...r.words, ...data.words] } : r,
        ),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setExpandingRoot(null);
    }
  }

  async function handleFindNewRoot() {
    setError(null);
    setFindingRoot(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "new-root",
          language: group.language,
          groupId: group.id,
          groupReading: group.reading,
          existingCharacters: group.roots.map((r) => r.character),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lỗi khi gọi AI");
      setGroup((g) => ({ ...g, roots: [...g.roots, data.root] }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setFindingRoot(false);
    }
  }

  async function handleGetMnemonic(word: VocabWord) {
    setError(null);
    setMnemonicLoadingId(word.id);
    try {
      const res = await fetch("/api/mnemonic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: group.language,
          wordId: word.id,
          headword: word.headword,
          reading: word.reading,
          meaningVn: word.meaningVn,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lỗi khi gọi AI");
      setGroup((g) => ({
        ...g,
        roots: g.roots.map((r) => ({
          ...r,
          words: updateWordInList(r.words, word.id, (w) => ({ ...w, mnemonicVn: data.mnemonicVn })),
        })),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setMnemonicLoadingId(null);
    }
  }

  async function handleExpandWord(word: VocabWord) {
    setError(null);
    setExpandingWordId(word.id);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "expand-word",
          language: group.language,
          wordId: word.id,
          headword: word.headword,
          reading: word.reading,
          meaningVn: word.meaningVn,
          existingChildHeadwords: (word.children ?? []).map((c) => c.headword),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lỗi khi gọi AI");
      setGroup((g) => ({
        ...g,
        roots: g.roots.map((r) => ({
          ...r,
          words: updateWordInList(r.words, word.id, (w) => ({
            ...w,
            children: [...(w.children ?? []), ...data.children],
          })),
        })),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setExpandingWordId(null);
    }
  }

  async function handleToggleBookmark(wordId: string) {
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(wordId)) next.delete(wordId);
      else next.add(wordId);
      return next;
    });
    try {
      await toggleBookmark(wordId);
    } catch {
      // rollback nếu lưu thất bại
      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        if (next.has(wordId)) next.delete(wordId);
        else next.add(wordId);
        return next;
      });
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-5xl">
        <Link href={`/${lang}`} className="text-sm font-medium text-brand-600 hover:underline">
          ← {group.language === "zh" ? "Tiếng Trung" : group.language === "ko" ? "Tiếng Hàn" : "Tiếng Nhật"}
        </Link>

        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Nhóm âm <span className="text-brand-600">&ldquo;{group.reading}&rdquo;</span>
          </h1>
          <Link
            href={`/${lang}/${group.id}/review`}
            className="rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:brightness-105"
          >
            🗂️ Ôn tập nhóm này
          </Link>
        </div>
        {group.note && <p className="mt-2 text-sm text-ink-muted">{group.note}</p>}

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="mt-6">
          <MindmapCanvas
            group={group}
            onExpandRoot={handleExpandRoot}
            expandingRootId={expandingRoot}
            onFindNewRoot={handleFindNewRoot}
            findingRoot={findingRoot}
            onGetMnemonic={handleGetMnemonic}
            mnemonicLoadingId={mnemonicLoadingId}
            onExpandWord={handleExpandWord}
            expandingWordId={expandingWordId}
            bookmarkedIds={bookmarkedIds}
            onToggleBookmark={handleToggleBookmark}
          />
        </div>
      </div>
    </main>
  );
}
