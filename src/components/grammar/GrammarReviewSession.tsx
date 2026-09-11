"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SrsRating } from "@/types/vocab";
import { loadGrammarProgress, rateGrammarCard, toggleGrammarBookmark, toggleGrammarMastered } from "@/lib/grammarProgress";
import { isDue, RATING_LABELS } from "@/lib/srs";
import { speak, ttsFailureMessage } from "@/lib/tts";
import { buildGrammarCards, type GrammarCardInfo } from "@/lib/grammarReviewCards";
import type { GrammarLanguageData } from "@/types/grammar";
import type { Language } from "@/types/vocab";
import GrammarStoryChain from "@/components/grammar/GrammarStoryChain";
import StoryNodeSentence from "@/components/grammar/StoryNodeSentence";

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

type RuntimeCard = GrammarCardInfo & { bookmarked?: boolean };

export default function GrammarReviewSession({
  data,
  lang,
  backHref,
}: {
  data: GrammarLanguageData;
  lang: string;
  backHref: string;
}) {
  const [ready, setReady] = useState(false);
  const [cards, setCards] = useState<RuntimeCard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [masteredBusy, setMasteredBusy] = useState(false);
  // Ẩn nghĩa tiếng Việt của câu ví dụ (thẻ "standard") mặc định — thấy pattern/cách chia/sắc thái là
  // đủ để tự hiểu, chỉ hiện nghĩa câu ví dụ khi thực sự cần, bấm "Xem nghĩa" mới hiện. Reset về ẩn mỗi
  // khi sang thẻ mới (xem resetCardState).
  const [exampleRevealed, setExampleRevealed] = useState(false);
  const [ttsWarning, setTtsWarning] = useState<string | null>(null);

  function handleSpeak(text: string, language: Language) {
    speak(text, language).then((r) => {
      setTtsWarning(r.ok ? null : ttsFailureMessage(r.reason));
    });
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const progress = await loadGrammarProgress();
      if (cancelled) return;
      const allCards: RuntimeCard[] = buildGrammarCards(data)
        .map((c) => ({ ...c, bookmarked: progress[c.id]?.bookmarked }))
        .filter((c) => !progress[c.id]?.mastered);
      const due = allCards.filter((c) => isDue(progress[c.id]));
      setCards(shuffle(due.length > 0 ? due : allCards));
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [data]);

  const current = cards[index];

  function resetCardState() {
    setFlipped(false);
    setSelectedChoice(null);
    setExampleRevealed(false);
    setTtsWarning(null);
  }

  // Tự phát âm khi thẻ mới hiện ra — an toàn ở CẢ 2 loại thẻ vì đề bài không giấu phần cần nghe:
  // "standard" chỉ hiện pattern ở mặt trước (đáp án là NGHĨA, không phải cách đọc); "confusion" hiện
  // sẵn cả câu ví dụ lẫn nghĩa (đáp án là CẤU TRÚC, nghe câu ví dụ không lộ đáp án). "story" KHÔNG tự
  // đọc ở đây vì mặt trước cố ý giấu câu gốc (chỉ hiện nghĩa để đoán) — nghe được câu gốc sẽ lộ đáp án.
  useEffect(() => {
    if (!current) return;
    if (current.kind === "standard") handleSpeak(current.point.pattern, lang as Language);
    else if (current.kind === "confusion") handleSpeak(current.quizExample.sentence, lang as Language);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  // Lật thẻ "standard" xong: đọc lại câu ví dụ (củng cố phát âm) — an toàn dù nghĩa câu ví dụ có đang
  // ẩn hay không, vì nghe câu gốc không tương đương với đọc được nghĩa tiếng Việt của nó.
  useEffect(() => {
    if (!current || current.kind !== "standard" || !flipped) return;
    const ex = current.point.examples[0];
    if (ex) handleSpeak(ex.sentence, lang as Language);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipped]);

  async function handleRate(r: SrsRating) {
    if (!current || ratingBusy) return;
    setRatingBusy(true);
    try {
      await rateGrammarCard(current.id, r);
    } finally {
      setRatingBusy(false);
    }
    setReviewedCount((c) => c + 1);
    resetCardState();
    setIndex((i) => i + 1);
  }

  async function handleToggleBookmark() {
    if (!current) return;
    const id = current.id;
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, bookmarked: !c.bookmarked } : c)));
    try {
      await toggleGrammarBookmark(id);
    } catch {
      setCards((cs) => cs.map((c) => (c.id === id ? { ...c, bookmarked: !c.bookmarked } : c)));
    }
  }

  async function handleToggleMastered() {
    if (!current || masteredBusy) return;
    const id = current.id;
    setMasteredBusy(true);
    setCards((cs) => cs.filter((c) => c.id !== id));
    resetCardState();
    try {
      await toggleGrammarMastered(id);
    } catch {
      // không rollback — đồng bộ lại ở lần tải trang sau
    } finally {
      setMasteredBusy(false);
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
        <p className="text-lg font-medium text-ink">Chưa có điểm ngữ pháp nào để ôn tập.</p>
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

  const showRatingBar =
    ((current.kind === "standard" || current.kind === "story") && flipped) ||
    (current.kind === "confusion" && selectedChoice !== null);

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
        <p className="mb-3 text-center text-xs font-medium text-ink-muted">
          {data.label} —{" "}
          {current.kind === "confusion"
            ? "⚡ Chọn đúng cấu trúc"
            : current.kind === "story"
              ? "🔗 Chuỗi ngữ cảnh"
              : "Thẻ ngữ pháp"}
        </p>

        <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-600 to-accent-500 transition-all"
            style={{ width: `${(index / cards.length) * 100}%` }}
          />
        </div>

        <div className="relative w-full rounded-3xl border border-border bg-surface-2 p-6 shadow-md">
          <button
            onClick={handleToggleBookmark}
            aria-label={current.bookmarked ? "Bỏ yêu thích" : "Đánh dấu yêu thích"}
            className={`absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full border text-base ${
              current.bookmarked
                ? "border-amber-400 bg-amber-100 text-amber-600"
                : "border-border bg-surface-3 text-ink-muted hover:bg-surface"
            }`}
          >
            {current.bookmarked ? "★" : "☆"}
          </button>

          {current.kind === "story" ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => setFlipped((f) => !f)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setFlipped((f) => !f);
              }}
              className="cursor-pointer"
            >
              {!flipped ? (
                <div className="text-center">
                  <div className="px-8 text-lg font-bold text-brand-600">{current.story.titleVn}</div>
                  <p className="mt-1 text-xs text-ink-muted">
                    Bạn có nhớ cách nói chuỗi này bằng {data.label.replace("Ngữ pháp ", "")} không?
                  </p>
                  <div className="mt-4 flex flex-col gap-2 text-left">
                    {current.story.steps.map((step, i) => (
                      <div key={i} className="rounded-lg bg-surface-3 px-3 py-2 text-sm">
                        <span className="font-semibold text-brand-600">{step.timeLabelVn}: </span>
                        <span className="text-ink">{step.example.translationVn}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 text-sm text-ink-muted">(Chạm để xem đáp án)</div>
                </div>
              ) : (
                <div onClick={(e) => e.stopPropagation()} className="cursor-default">
                  <GrammarStoryChain story={current.story} lang={lang as Language} />
                </div>
              )}
            </div>
          ) : current.kind === "standard" ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => setFlipped((f) => !f)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setFlipped((f) => !f);
              }}
              className="cursor-pointer text-center"
            >
              <div className="flex items-center justify-center gap-2 px-8">
                <div className="text-2xl font-bold text-brand-600">{current.point.pattern}</div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSpeak(current.point.pattern, lang as Language);
                  }}
                  aria-label="Đọc cấu trúc"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface-3 text-sm hover:bg-surface"
                >
                  🔊
                </button>
              </div>
              {!flipped && <div className="mt-6 text-sm text-ink-muted">(Chạm để lật thẻ)</div>}

              {flipped && (
                <div className="mt-4 border-t border-border pt-4 text-left">
                  <div className="text-base font-semibold text-ink">{current.point.meaningVn}</div>
                  <p className="mt-1 text-xs text-ink-muted">
                    <span className="font-semibold">Cách chia:</span> {current.point.formationRule}
                  </p>
                  <p className="mt-2 rounded-lg bg-surface-3 px-3 py-2 text-xs text-ink">
                    {current.point.nuanceVn}
                  </p>
                  {current.point.examples[0] && (
                    <div className="mt-2 rounded-lg bg-surface px-3 py-2 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <StoryNodeSentence sentence={current.point.examples[0].sentence} lang={lang as Language} className="font-medium text-ink" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSpeak(current.point.examples[0].sentence, lang as Language);
                          }}
                          aria-label="Đọc ví dụ"
                          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface-3 text-sm hover:bg-surface-2"
                        >
                          🔊
                        </button>
                      </div>
                      {exampleRevealed ? (
                        <>
                          <p className="mt-1 text-ink-muted">{current.point.examples[0].translationVn}</p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExampleRevealed(false);
                            }}
                            className="mt-0.5 text-[11px] text-ink-muted underline decoration-dotted hover:text-ink"
                          >
                            Ẩn nghĩa
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExampleRevealed(true);
                          }}
                          className="mt-1 text-xs font-medium text-brand-600 underline decoration-dotted hover:text-brand-700"
                        >
                          👁 Xem nghĩa
                        </button>
                      )}
                    </div>
                  )}
                  {current.point.commonMistakeVn && (
                    <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                      <span className="font-semibold">⚠️</span> {current.point.commonMistakeVn}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-brand-600">
                    <span className="font-semibold">💡</span> {current.point.mnemonicVn}
                  </p>
                  {current.point.confusionGroupId && (
                    <Link
                      href={`/grammar/${lang}/confusion#${current.point.confusionGroupId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-accent-500/10 px-2.5 py-1 text-xs font-medium text-accent-600 hover:bg-accent-500/20"
                    >
                      ⚡ Xem cụm dễ nhầm liên quan
                    </Link>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-left">
              <div className="px-8 text-center text-sm font-bold text-ink">{current.group.titleVn}</div>
              <div className="mt-3 rounded-lg bg-surface px-3 py-2 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <StoryNodeSentence sentence={current.quizExample.sentence} lang={lang as Language} className="font-medium text-ink" />
                  <button
                    onClick={() => handleSpeak(current.quizExample.sentence, lang as Language)}
                    aria-label="Đọc ví dụ"
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface-3 text-sm hover:bg-surface-2"
                  >
                    🔊
                  </button>
                </div>
                <div className="text-ink-muted">{current.quizExample.translationVn}</div>
              </div>
              <p className="mt-3 text-center text-sm text-ink">Câu này minh hoạ cho cấu trúc nào?</p>
              <div className="mt-2 flex flex-col gap-2">
                {current.points.map((p) => {
                  const isCorrect = p.id === current.quizExample.correctPointId;
                  const isPicked = p.id === selectedChoice;
                  const showResult = selectedChoice !== null;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={showResult}
                      onClick={() => setSelectedChoice(p.id)}
                      className={`rounded-xl border px-4 py-2 text-left text-sm font-semibold transition ${
                        showResult && isCorrect
                          ? "border-green-400 bg-green-100 text-green-700"
                          : showResult && isPicked && !isCorrect
                            ? "border-red-400 bg-red-100 text-red-700"
                            : "border-border bg-surface text-ink hover:border-brand-300"
                      }`}
                    >
                      {p.pattern}
                    </button>
                  );
                })}
              </div>
              {selectedChoice !== null && (
                <p className="mt-3 rounded-lg bg-surface-3 px-3 py-2 text-xs text-ink">
                  {selectedChoice === current.quizExample.correctPointId ? "✅ Chính xác! " : "❌ Chưa đúng. "}
                  {current.group.summaryVn}
                </p>
              )}
            </div>
          )}
        </div>

        {ttsWarning && (
          <p className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            🔇 {ttsWarning}
            <button onClick={() => setTtsWarning(null)} className="font-semibold underline">
              Đóng
            </button>
          </p>
        )}

        {showRatingBar && (
          <>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {([0, 1, 2, 3] as SrsRating[]).map((r) => (
                <button
                  key={r}
                  onClick={() => handleRate(r)}
                  disabled={ratingBusy}
                  className={`rounded-full px-2 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 ${RATING_STYLE[r]}`}
                >
                  {RATING_LABELS[r]}
                </button>
              ))}
            </div>
            <button
              onClick={handleToggleMastered}
              disabled={masteredBusy}
              className="mt-2 w-full text-center text-xs font-medium text-green-600 underline decoration-dotted hover:text-green-700 disabled:opacity-50"
            >
              {masteredBusy ? "Đang lưu…" : "✅ Đã thuộc kỹ rồi — bỏ qua, không hiện lại trong ôn tập"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
