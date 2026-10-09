"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { SoundGroup, SrsRating } from "@/types/vocab";
import type { TopicGroup } from "@/types/topic";
import { loadProgress, rateWord, toggleBookmark, toggleMastered } from "@/lib/progress";
import { RATING_LABELS } from "@/lib/srs";
import { estimateSpeechMs, localeForLanguage, speak, speakAndWait, ttsFailureMessage } from "@/lib/tts";
import { buildCardsFromGroup, buildCardsFromTopic } from "@/lib/reviewCards";
import { buildReviewQueue, DEFAULT_SESSION_SIZE, type QueuedCard, type ReviewStats } from "@/lib/reviewQueue";
import { toPinyin } from "@/lib/zhPinyin";

const RATING_STYLE: Record<SrsRating, string> = {
  0: "bg-red-500 hover:bg-red-600",
  1: "bg-orange-500 hover:bg-orange-600",
  2: "bg-blue-500 hover:bg-blue-600",
  3: "bg-green-500 hover:bg-green-600",
};

/** Mốc "đã ôn tới đâu" của cả nhóm — thứ mà trước đây hoàn toàn không hiện ở đâu, nên bỏ dở một nhóm
 * lớn rồi quay lại thì không biết mình đang ở đâu trong đó. Số liệu lấy từ tiến độ đã lưu trên server,
 * nên mở ở máy khác vẫn đúng. */
function Milestone({ stats, justReviewed = 0 }: { stats: ReviewStats; justReviewed?: number }) {
  const done = stats.mastered + stats.reviewed;
  const pct = stats.total > 0 ? Math.round((done / stats.total) * 100) : 0;
  return (
    <div className="w-full max-w-md rounded-xl border border-border bg-surface-2 px-3 py-2 text-left text-xs">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
        <span className="font-semibold text-ink">
          📍 Đã ôn {done}/{stats.total} từ trong nhóm
        </span>
        <span className="text-ink-muted">{pct}%</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-accent-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-ink-muted">
        {stats.neverReviewed > 0 && <span>🆕 {stats.neverReviewed} từ chưa ôn lần nào</span>}
        {stats.mastered > 0 && <span>✅ {stats.mastered} đã thuộc</span>}
        {justReviewed > 0 && <span>vừa xong {justReviewed} thẻ</span>}
      </div>
    </div>
  );
}

export default function ReviewSession({
  groups,
  topics,
  title,
  backHref,
  limit,
}: {
  /** Nguồn thẻ trục đồng âm/hình/bẫy nghĩa/phụ âm đầu — truyền 1 trong 2, KHÔNG truyền cả `groups`
   * lẫn `topics` cùng lúc. */
  groups?: SoundGroup[];
  /** Nguồn thẻ mindmap chủ đề — xem `buildCardsFromTopic`. */
  topics?: TopicGroup[];
  title: string;
  backHref: string;
  /** Giới hạn số thẻ lấy ngẫu nhiên cho 1 phiên ôn NGẮN (vd "🎲 Ôn 15 từ ngẫu nhiên") — không truyền
   * thì giữ hành vi cũ: ôn TOÀN BỘ thẻ due/đang có (như "🗂️ Luyện tập cả"). */
  limit?: number;
}) {
  const [ready, setReady] = useState(false);
  const [cards, setCards] = useState<QueuedCard[]>([]);
  /** Mốc của CẢ phạm vi ôn (không phải của phiên này) — tính lại từ tiến độ mỗi lần bắt đầu phiên. */
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [rating, setRatingBusy] = useState(false);
  const [mnemonicLoading, setMnemonicLoading] = useState(false);
  const [expandingWord, setExpandingWord] = useState(false);
  const [pendingExpandWord, setPendingExpandWord] = useState(false);
  const [expandedWordIds, setExpandedWordIds] = useState<Set<string>>(new Set());
  const [ttsWarning, setTtsWarning] = useState<string | null>(null);
  const [masteredBusy, setMasteredBusy] = useState(false);
  /** Lật thẻ xong có đọc luôn câu ví dụ không. Bật sẵn (đây là thứ người học hỏi xin), nhưng phải tắt
   * được: đọc cả câu mỗi lần lật thì ôn nhanh bị chậm hẳn lại, và không phải lúc nào cũng tiện bật
   * loa. Ghi vào localStorage nên chọn một lần là nhớ mãi. */
  const [autoReadExample, setAutoReadExample] = useState(true);

  useEffect(() => {
    try {
      setAutoReadExample(window.localStorage.getItem(AUTO_READ_KEY) !== "0");
    } catch {
      // chế độ riêng tư chặn localStorage — cứ giữ mặc định bật
    }
  }, []);

  function toggleAutoRead() {
    setAutoReadExample((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(AUTO_READ_KEY, next ? "1" : "0");
      } catch {
        // không lưu được thì vẫn áp dụng cho phiên này
      }
      return next;
    });
  }

  // Tự phát âm để "nghe cho quen": 1 lần ngay khi thẻ mới xuất hiện (mặt trước, chỉ có headword —
  // chưa lộ nghĩa nên an toàn), và khi lật thẻ thì đọc lại từ RỒI ĐỌC LUÔN CÂU VÍ DỤ.
  //
  // Phải đọc TUẦN TỰ bằng `speakAndWait`: `speechSynthesis.speak()` gọi liên tiếp sẽ chồng tiếng, mà
  // `speakAndWait` lại `cancel()` trước mỗi lần đọc nên gọi song song là từ bị nuốt mất. Mỗi lượt đọc
  // mang một "token"; lật úp lại hay sang thẻ khác giữa chừng thì token đổi và vòng lặp tự thoát, nếu
  // không thì câu ví dụ của thẻ CŨ sẽ còn đọc tiếp đè lên thẻ mới.
  const playTokenRef = useRef(0);

  const stopSpeaking = useCallback(() => {
    playTokenRef.current++;
    try {
      window.speechSynthesis?.cancel();
    } catch {
      // trình duyệt không hỗ trợ TTS — không có gì để dừng
    }
  }, []);

  function handleSpeak(text: string, language: SoundGroup["language"]) {
    // Bấm nút loa là người học muốn nghe ĐÚNG đoạn này — huỷ hàng đọc tự động đang chạy, nếu không
    // `speakAndWait` của bước sau sẽ `cancel()` ngay cái vừa bấm.
    stopSpeaking();
    speak(text, language).then((r) => {
      setTtsWarning(r.ok ? null : ttsFailureMessage(r.reason));
    });
  }

  const current = cards[index];

  useEffect(() => {
    if (!current) return;
    const token = ++playTokenRef.current;
    const locale = localeForLanguage(current.language);
    const queue = [current.word.headword];
    // Câu ví dụ chỉ đọc ở mặt sau: mặt trước mà đọc cả câu là lộ luôn ngữ cảnh, mất tác dụng của thẻ.
    if (flipped && autoReadExample && current.word.example.trim()) queue.push(current.word.example);

    (async () => {
      for (const text of queue) {
        if (playTokenRef.current !== token) return;
        // `speakAndWait` mặc định bỏ cuộc sau 4s — đủ cho một từ, nhưng cắt ngang một câu ví dụ dài.
        const r = await speakAndWait(text, locale, 0.85, estimateSpeechMs(text));
        if (playTokenRef.current !== token) return;
        if (!r.ok) {
          setTtsWarning(ttsFailureMessage(r.reason));
          return;
        }
        setTtsWarning(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.word.id, flipped, autoReadExample]);

  useEffect(() => stopSpeaking, [stopSpeaking]);

  /** Dựng một phiên mới từ tiến độ MỚI NHẤT. Gọi cả lúc mở trang lẫn lúc bấm "Ôn tiếp" ở màn hình
   * kết thúc — nhờ đọc lại tiến độ, phiên tiếp theo tự bỏ qua những từ vừa chấm xong ở phiên trước,
   * không cần giữ con trỏ nào. */
  const startSession = useCallback(async (): Promise<boolean> => {
    const progress = await loadProgress();
    const allCards = topics
      ? topics.flatMap((t) => buildCardsFromTopic(t, progress))
      : (groups ?? []).flatMap((g) => buildCardsFromGroup(g, progress));
    const { queue, stats: s } = buildReviewQueue(allCards, progress, limit ?? DEFAULT_SESSION_SIZE);
    setCards(queue);
    setStats(s);
    setIndex(0);
    setFlipped(false);
    setReviewedCount(0);
    setPendingExpandWord(false);
    setTtsWarning(null);
    return queue.length > 0;
  }, [groups, topics, limit]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await startSession();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [startSession]);

  const examplePinyin = useMemo(() => {
    if (!current || current.language !== "zh") return "";
    return toPinyin(current.word.example);
  }, [current]);

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
    setTtsWarning(null);
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

  async function handleToggleMastered() {
    if (!current || masteredBusy) return;
    const wordId = current.word.id;
    setMasteredBusy(true);
    // Đánh dấu "đã thuộc" nghĩa là bỏ luôn thẻ này khỏi phiên ôn hiện tại — không cần chấm điểm
    // nữa, thẻ tiếp theo tự trượt lên đúng vị trí index hiện tại sau khi bỏ.
    setCards((cs) => cs.filter((c) => c.word.id !== wordId));
    // Mốc phải nhúc nhích ngay theo thao tác này, không đợi tải lại trang: "đã thuộc" cũng là một
    // cách hoàn thành một từ, y như chấm điểm.
    setStats((s) =>
      s
        ? {
            ...s,
            mastered: s.mastered + 1,
            reviewed: current.reviewCount > 0 ? s.reviewed - 1 : s.reviewed,
            neverReviewed: current.reviewCount === 0 ? s.neverReviewed - 1 : s.neverReviewed,
            pending: Math.max(0, s.pending - 1),
          }
        : s,
    );
    setFlipped(false);
    setPendingExpandWord(false);
    setTtsWarning(null);
    try {
      await toggleMastered(wordId);
    } catch {
      // không rollback lại danh sách để tránh nhảy lộn xộn — lần tải trang sau sẽ đồng bộ lại
    } finally {
      setMasteredBusy(false);
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
        <p className="text-lg font-medium text-ink">
          {stats && stats.total > 0 ? "Hết từ đến hạn rồi — nghỉ đi, mai quay lại." : "Chưa có từ nào để ôn tập."}
        </p>
        {stats && stats.total > 0 && <Milestone stats={stats} />}
        <Link href={backHref} className="text-sm text-brand-600 hover:underline">
          ← Quay lại
        </Link>
      </main>
    );
  }

  if (index >= cards.length) {
    const left = stats ? Math.max(0, stats.pending - reviewedCount) : 0;
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="rounded-3xl bg-gradient-to-br from-brand-600 to-accent-500 px-8 py-10 text-white shadow-lg">
          <p className="text-4xl">🎉</p>
          <p className="mt-2 text-lg font-semibold">Đã ôn xong {reviewedCount} thẻ!</p>
        </div>
        {stats && <Milestone stats={stats} justReviewed={reviewedCount} />}
        <div className="flex flex-wrap justify-center gap-3">
          {/* Phần còn lại không mất đi đâu cả — nói rõ còn bao nhiêu và cho đi tiếp ngay tại đây,
              đó mới là thứ biến "không ôn hết 100%" thành chuyện bình thường. */}
          {left > 0 && (
            <button
              onClick={() => {
                setReady(false);
                startSession().finally(() => setReady(true));
              }}
              className="rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:brightness-105"
            >
              ▶ Ôn tiếp {Math.min(left, limit ?? DEFAULT_SESSION_SIZE)} thẻ (còn {left})
            </button>
          )}
          <Link
            href={backHref}
            className="rounded-full border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-ink hover:border-brand-300"
          >
            Quay lại
          </Link>
          <Link
            href="/"
            className="rounded-full border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-ink hover:border-brand-300"
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

        {stats && stats.total > cards.length && (
          <div className="mb-3">
            <Milestone stats={stats} justReviewed={reviewedCount} />
          </div>
        )}

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

          {/* Biết thẻ này mới tinh hay đã gặp mấy lần thì chấm điểm mới có cơ sở — "Quên rồi" ở lần
              đầu gặp và ở lần thứ năm là hai chuyện hoàn toàn khác nhau. */}
          <div className="absolute top-3 left-3 rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-medium text-ink-muted">
            {current.reviewCount === 0 ? "🆕 Chưa ôn lần nào" : `🔁 Ôn lần ${current.reviewCount + 1}`}
          </div>

          <div className="mt-4 flex items-center justify-center gap-2">
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
                  {examplePinyin && (
                    <div className="mt-0.5 text-xs text-ink-muted italic">{examplePinyin}</div>
                  )}
                  <div className="mt-0.5 text-sm text-ink-muted italic">{current.word.exampleVn}</div>
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
                {current.contextLabel ?? "Gốc"}:{" "}
                <span className="font-medium text-ink">{current.rootChar}</span>
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
          <>
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
