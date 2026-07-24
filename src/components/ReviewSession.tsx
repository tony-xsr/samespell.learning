"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SoundGroup, SrsRating } from "@/types/vocab";
import { loadProgress, rateWord, toggleBookmark } from "@/lib/progress";
import { isDue, RATING_LABELS } from "@/lib/srs";
import { speak, ttsFailureMessage } from "@/lib/tts";
import { buildCardsFromGroup, type CardInfo } from "@/lib/reviewCards";

const RATING_STYLE: Record<SrsRating, string> = {
  0: "bg-red-500 hover:bg-red-600",
  1: "bg-orange-500 hover:bg-orange-600",
  2: "bg-blue-500 hover:bg-blue-600",
  3: "bg-green-500 hover:bg-green-600",
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function ReviewSession({
  groups,
  title,
  backHref,
}: {
  groups: SoundGroup[];
  title: string;
  backHref: string;
}) {
  const [ready, setReady] = useState(false);
  const [cards, setCards] = useState<CardInfo[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [rating, setRatingBusy] = useState(false);
  const [mnemonicLoading, setMnemonicLoading] = useState(false);
  const [expandingWord, setExpandingWord] = useState(false);
  const [pendingExpandWord, setPendingExpandWord] = useState(false);
  const [expandedWordIds, setExpandedWordIds] = useState<Set<string>>(new Set());
  const [ttsWarning, setTtsWarning] = useState<string | null>(null);

  function handleSpeak(text: string, language: SoundGroup["language"]) {
    speak(text, language).then((r) => {
      setTtsWarning(r.ok ? null : ttsFailureMessage(r.reason));
    });
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const progress = await loadProgress();
      if (cancelled) return;
      const allCards: CardInfo[] = groups.flatMap((g) => buildCardsFromGroup(g, progress));
      const due = allCards.filter((c) => isDue(progress[c.word.id]));
      setCards(shuffle(due.length > 0 ? due : allCards));
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [groups]);

  const current = cards[index];

  async function handleRate(r: SrsRating) {
    if (!current || rating) return;
    setRatingBusy(true);
    try {
      await rateWord(current.word.id, r);
    } finally {
      setRatingBusy(false);
    }
    setReviewedCount((c) => c + 1);
    setFlipped(false);
    setPendingExpandWord(false);
    setIndex((i) => i + 1);
  }

  async function handleToggleBookmark() {
    if (!current) return;
    const wordId = current.word.id;
    setCards((cs) => cs.map((c) => (c.word.id === wordId ? { ...c, bookmarked: !c.bookmarked } : c)));
    try {
      await toggleBookmark(wordId);
    } catch {
      setCards((cs) => cs.map((c) => (c.word.id === wordId ? { ...c, bookmarked: !c.bookmarked } : c)));
    }
  }

  async function handleGetMnemonic() {
    if (!current || mnemonicLoading) return;
    setMnemonicLoading(true);
    try {
      const res = await fetch("/api/mnemonic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: current.language,
          wordId: current.word.id,
          headword: current.word.headword,
          reading: current.word.reading,
          meaningVn: current.word.meaningVn,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lỗi khi gọi AI");
      setCards((cs) =>
        cs.map((c) =>
          c.word.id === current.word.id ? { ...c, word: { ...c.word, mnemonicVn: data.mnemonicVn } } : c,
        ),
      );
    } catch {
      // im lặng bỏ qua — không có mẹo nhớ cũng không sao
    } finally {
      setMnemonicLoading(false);
    }
  }

  async function handleExpandWord() {
    if (!current || expandingWord) return;
    setExpandingWord(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "expand-word",
          language: current.language,
          wordId: current.word.id,
          headword: current.word.headword,
          reading: current.word.reading,
          meaningVn: current.word.meaningVn,
          existingChildHeadwords: (current.word.children ?? []).map((c) => c.headword),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lỗi khi gọi AI");
      setExpandedWordIds((ids) => new Set(ids).add(current.word.id));
    } catch {
      // im lặng bỏ qua
    } finally {
      setExpandingWord(false);
    }
  }

  if (!ready) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-ink-muted">Đang tải...</p>
      </main>
    );
  }

  if (cards.length === 0) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-lg font-medium text-ink">Chưa có từ nào để ôn tập.</p>
        <Link href={backHref} className="text-sm text-brand-600 hover:underline">
          ← Quay lại
        </Link>
      </main>
    );
  }

  if (index >= cards.length) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="rounded-3xl bg-gradient-to-br from-brand-600 to-accent-500 px-8 py-10 text-white shadow-lg">
          <p className="text-4xl">🎉</p>
          <p className="mt-2 text-lg font-semibold">Đã ôn xong {reviewedCount} thẻ!</p>
        </div>
        <div className="flex gap-3">
          <Link
            href={backHref}
            className="rounded-full border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-ink hover:border-brand-300"
          >
            Quay lại
          </Link>
          <Link
            href="/"
            className="rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:brightness-105"
          >
            Trang chủ
          </Link>
        </div>
      </main>
    );
  }

  const hasExpandedBranch = current.word.children && current.word.children.length > 0;
  const justExpanded = expandedWordIds.has(current.word.id);

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-1 flex items-center justify-between text-sm text-ink-muted">
          <Link href={backHref} className="font-medium text-brand-600 hover:underline">
            ← Thoát
          </Link>
          <span>
            {index + 1} / {cards.length}
          </span>
        </div>
        <p className="mb-3 text-center text-xs font-medium text-ink-muted">{title}</p>

        <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-600 to-accent-500 transition-all"
            style={{ width: `${((index + (flipped ? 0.5 : 0)) / cards.length) * 100}%` }}
          />
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => setFlipped((f) => !f)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setFlipped((f) => !f);
          }}
          className="relative block w-full cursor-pointer rounded-3xl border border-border bg-surface-2 p-8 text-center shadow-md transition hover:shadow-lg"
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggleBookmark();
            }}
            aria-label={current.bookmarked ? "Bỏ yêu thích" : "Đánh dấu yêu thích"}
            className={`absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full border text-base ${
              current.bookmarked
                ? "border-amber-400 bg-amber-100 text-amber-600"
                : "border-border bg-surface-3 text-ink-muted hover:bg-surface"
            }`}
          >
            {current.bookmarked ? "★" : "☆"}
          </button>

          <div className="flex items-center justify-center gap-2">
            <div className="text-3xl font-bold text-ink">{current.word.headword}</div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSpeak(current.word.headword, current.language);
              }}
              aria-label="Đọc từ"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-3 text-sm hover:bg-surface"
            >
              🔊
            </button>
          </div>
          <div className="mt-1 text-lg text-ink-muted">{current.word.reading}</div>

          {flipped && (
            <div className="mt-6 border-t border-border pt-6 text-left">
              <div className="text-lg font-semibold text-brand-600">{current.word.meaningVn}</div>

              <div className="mt-3 flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm text-ink">{current.word.example}</div>
                  <div className="text-sm text-ink-muted italic">{current.word.exampleVn}</div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSpeak(current.word.example, current.language);
                  }}
                  aria-label="Đọc ví dụ"
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface-3 text-sm hover:bg-surface"
                >
                  🔊
                </button>
              </div>

              {current.word.grammarPoint && (
                <div className="mt-3 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                  <span className="font-semibold">📚 Ngữ pháp: {current.word.grammarPoint}</span>
                  {current.word.grammarExplanationVn && (
                    <div className="mt-0.5">{current.word.grammarExplanationVn}</div>
                  )}
                </div>
              )}

              {current.word.mnemonicVn ? (
                <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                  💡 {current.word.mnemonicVn}
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGetMnemonic();
                  }}
                  disabled={mnemonicLoading}
                  className="mt-3 text-xs font-medium text-amber-600 underline decoration-dotted hover:text-amber-700 disabled:opacity-50"
                >
                  {mnemonicLoading ? "Đang nghĩ mẹo nhớ…" : "💡 Xem mẹo nhớ"}
                </button>
              )}

              <div className="mt-3">
                {hasExpandedBranch || justExpanded ? (
                  <span className="text-xs font-medium text-green-600">
                    🌿 Đã mở rộng nhánh — xem trong mindmap
                  </span>
                ) : pendingExpandWord ? (
                  <span
                    className="flex items-center gap-2 text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-ink-muted">Mở rộng nhánh từ từ này?</span>
                    <button
                      onClick={() => {
                        setPendingExpandWord(false);
                        handleExpandWord();
                      }}
                      className="font-semibold text-green-600 hover:underline"
                    >
                      Có
                    </button>
                    <button
                      onClick={() => setPendingExpandWord(false)}
                      className="font-semibold text-ink-muted hover:underline"
                    >
                      Không
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingExpandWord(true);
                    }}
                    disabled={expandingWord}
                    className="text-xs font-medium text-brand-600 underline decoration-dotted hover:text-brand-700 disabled:opacity-50"
                  >
                    {expandingWord ? "Đang mở rộng…" : "🌿 Mở rộng nhánh từ từ này"}
                  </button>
                )}
              </div>

              <div className="mt-4 rounded-lg bg-surface-3 px-3 py-2 text-xs text-ink-muted">
                Gốc: <span className="font-medium text-ink">{current.rootChar}</span>
                {current.rootHanViet ? ` (${current.rootHanViet})` : ""} — {current.rootMeaning}
                {current.siblings.length > 0 && (
                  <div className="mt-1">
                    Cùng âm &ldquo;{current.groupReading}&rdquo; còn có:{" "}
                    {current.siblings.map((s) => `${s.character} (${s.meaningVn})`).join(", ")}
                  </div>
                )}
              </div>
            </div>
          )}

          {!flipped && <div className="mt-6 text-sm text-ink-muted">(Chạm để lật thẻ)</div>}
        </div>

        {ttsWarning && (
          <p className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            🔇 {ttsWarning}
            <button onClick={() => setTtsWarning(null)} className="font-semibold underline">
              Đóng
            </button>
          </p>
        )}

        {flipped && (
          <div className="mt-4 grid grid-cols-4 gap-2">
            {([0, 1, 2, 3] as SrsRating[]).map((r) => (
              <button
                key={r}
                onClick={() => handleRate(r)}
                disabled={rating}
                className={`rounded-full px-2 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 ${RATING_STYLE[r]}`}
              >
                {RATING_LABELS[r]}
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
