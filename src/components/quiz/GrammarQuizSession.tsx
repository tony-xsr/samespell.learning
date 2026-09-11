"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Language } from "@/types/vocab";
import type { GrammarQuizMode, GrammarQuizQuestion } from "@/lib/grammarQuizTypes";
import { speak } from "@/lib/tts";
import { rateGrammarCard } from "@/lib/grammarProgress";

const REFLEX_SECONDS = 6;
const BATCH_SIZE = 12;
const ANSWER_DELAY_MS = 1100;
const REFETCH_THRESHOLD = 3;

const MODE_LABEL: Record<GrammarQuizMode, string> = {
  meaning: "Trắc nghiệm nghĩa",
  usage: "Trắc nghiệm cách dùng",
};

const QUESTION_COPY: Record<GrammarQuizMode, string> = {
  meaning: "Cấu trúc này nghĩa là gì?",
  usage: "Câu này minh hoạ cho cấu trúc nào?",
};

const LANG_FLAG: Record<Language, string> = { zh: "🇨🇳", ja: "🇯🇵", ko: "🇰🇷", en: "🇬🇧" };

// Mỗi giá trị là 1 chuỗi class Tailwind ĐẦY ĐỦ, viết tĩnh để trình quét nội dung Tailwind nhận diện
// được — giống hệt bảng màu bên `QuizSession.tsx` (từ vựng) để 2 khu vực trắc nghiệm nhất quán.
const GRADIENT: Record<Language, string> = {
  zh: "from-red-600 via-red-500 to-amber-500",
  ja: "from-rose-500 via-pink-500 to-indigo-600",
  ko: "from-blue-600 via-indigo-500 to-rose-500",
  en: "from-slate-800 via-slate-700 to-teal-600",
};

const CONFETTI_EMOJI = ["🎉", "✨", "🎊", "⭐️", "💫", "🥳"];

interface Props {
  lang: Language;
  mode: GrammarQuizMode;
  reflex: boolean;
  /** Thay vì tự chuyển câu sau ANSWER_DELAY_MS, dừng lại hiện bảng giải thích đầy đủ (nghĩa/sắc thái/
   * ví dụ/lỗi hay gặp/mẹo nhớ) và chờ người dùng chủ động bấm "Câu tiếp theo". */
  explainMode: boolean;
}

async function fetchQuestions(lang: Language, mode: GrammarQuizMode): Promise<GrammarQuizQuestion[]> {
  const res = await fetch(`/api/grammar-quiz/questions?lang=${lang}&mode=${mode}&count=${BATCH_SIZE}`);
  if (!res.ok) throw new Error("Không tải được câu hỏi.");
  const data = await res.json();
  return Array.isArray(data.questions) ? data.questions : [];
}

function rateAnswer(pointId: string, correct: boolean) {
  rateGrammarCard(pointId, correct ? 2 : 0).catch(() => {
    /* không chặn UI nếu ghi tiến trình thất bại */
  });
}

/** 2 khối mờ trôi nhẹ phía sau nội dung — giống hệt `QuizSession.tsx` để 2 khu vực trắc nghiệm đồng bộ. */
function QuizBackdrop() {
  return (
    <>
      <div className="quiz-blob pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
      <div
        className="quiz-blob pointer-events-none absolute -bottom-20 -right-10 h-64 w-64 rounded-full bg-white/10 blur-3xl"
        style={{ animationDelay: "-4s" }}
      />
    </>
  );
}

function ScoreRing({ percent }: { percent: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);
  return (
    <svg width={128} height={128} viewBox="0 0 128 128" className="drop-shadow-md">
      <circle cx={64} cy={64} r={radius} stroke="rgba(255,255,255,0.25)" strokeWidth={12} fill="none" />
      <circle
        cx={64}
        cy={64}
        r={radius}
        stroke="white"
        strokeWidth={12}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 64 64)"
        style={{ transition: "stroke-dashoffset 0.9s ease-out" }}
      />
      <text x={64} y={72} textAnchor="middle" fontSize={26} fontWeight={700} fill="white">
        {percent}%
      </text>
    </svg>
  );
}

export default function GrammarQuizSession({ lang, mode, reflex, explainMode }: Props) {
  const [sessionKey, setSessionKey] = useState(0);
  const [questions, setQuestions] = useState<GrammarQuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fetchingMore, setFetchingMore] = useState(false);

  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [finished, setFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(REFLEX_SECONDS);

  const advanceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const current = questions[index];
  const gradientClass = GRADIENT[lang];

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const qs = await fetchQuestions(lang, mode);
      setQuestions(qs);
    } catch {
      setErrorMsg("Không tải được câu hỏi. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, [lang, mode]);

  useEffect(() => {
    setQuestions([]);
    setIndex(0);
    setScore(0);
    setAnswered(0);
    setStreak(0);
    setBestStreak(0);
    setFinished(false);
    setSelectedOptionId(null);
    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, mode, sessionKey]);

  // Tự tải thêm câu hỏi khi sắp hết batch hiện tại.
  useEffect(() => {
    if (loading || finished || fetchingMore) return;
    if (questions.length - index > REFETCH_THRESHOLD) return;
    setFetchingMore(true);
    fetchQuestions(lang, mode)
      .then((more) => setQuestions((prev) => [...prev, ...more]))
      .catch(() => {
        /* im lặng — vẫn còn câu hiện tại để làm tiếp */
      })
      .finally(() => setFetchingMore(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, questions.length, loading, finished]);

  const clearTimers = useCallback(() => {
    if (advanceTimeout.current) clearTimeout(advanceTimeout.current);
    if (tickInterval.current) clearInterval(tickInterval.current);
    advanceTimeout.current = null;
    tickInterval.current = null;
  }, []);

  const goToNext = useCallback(() => {
    setSelectedOptionId(null);
    setTimeLeft(REFLEX_SECONDS);
    setIndex((i) => i + 1);
  }, []);

  const handleAnswer = useCallback(
    (optionId: string | null) => {
      if (!current || selectedOptionId !== null) return;
      clearTimers();

      const correctOption = current.options.find((o) => o.correct);
      const isCorrect = optionId !== null && optionId === correctOption?.id;

      setSelectedOptionId(optionId ?? "__timeout__");
      setAnswered((n) => n + 1);
      if (isCorrect) {
        setScore((s) => s + 1);
        setStreak((s) => {
          const next = s + 1;
          setBestStreak((b) => Math.max(b, next));
          return next;
        });
      } else {
        setStreak(0);
      }

      rateAnswer(current.answerPointId, isCorrect);

      // Chế độ "chờ xem giải thích": KHÔNG tự chuyển câu — người dùng đọc xong bảng giải thích rồi
      // chủ động bấm "Câu tiếp theo" (xem goToNext, gọi từ nút bên dưới).
      if (!explainMode) {
        advanceTimeout.current = setTimeout(goToNext, ANSWER_DELAY_MS);
      }
    },
    [current, selectedOptionId, clearTimers, explainMode, goToNext],
  );

  // Phát âm tự động khi thẻ mới hiện ra — an toàn ở CẢ 2 mode vì đề bài không giấu phần cần nghe:
  // mode "meaning" chỉ hiện pattern (đáp án là NGHĨA, không phải cách đọc); mode "usage" hiện sẵn cả
  // câu ví dụ lẫn nghĩa tiếng Việt của nó (đáp án là CẤU TRÚC, nghe câu ví dụ không lộ đáp án).
  useEffect(() => {
    if (!current) return;
    const text = current.mode === "meaning" ? current.answerPattern : current.promptLabel;
    speak(text, current.language);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  // Bộ đếm giờ chế độ Phản xạ — chạy lại mỗi khi sang câu mới.
  useEffect(() => {
    if (!reflex || !current || selectedOptionId !== null || finished) return;
    setTimeLeft(REFLEX_SECONDS);
    tickInterval.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (tickInterval.current) clearInterval(tickInterval.current);
          handleAnswer(null);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (tickInterval.current) clearInterval(tickInterval.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reflex, current?.id, finished]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        left: Math.round(Math.random() * 94),
        emoji: CONFETTI_EMOJI[i % CONFETTI_EMOJI.length],
        delay: Math.round(Math.random() * 500),
        size: 16 + Math.round(Math.random() * 14),
      })),
    [sessionKey],
  );

  const accuracy = answered > 0 ? Math.round((score / answered) * 100) : 0;
  const timerFraction = timeLeft / REFLEX_SECONDS;
  const timerColor = timerFraction > 0.5 ? "bg-emerald-300" : timerFraction > 0.25 ? "bg-yellow-300" : "bg-red-400";

  if (loading) {
    return (
      <div
        className={`relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-br ${gradientClass} px-6 text-center text-white`}
        style={{
          paddingTop: "max(1.5rem, env(safe-area-inset-top))",
          paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
        }}
      >
        <QuizBackdrop />
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/25 border-t-white" />
        <p className="quiz-fade-in-up mt-4 text-sm font-medium text-white/90">Đang tải câu hỏi...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div
        className={`relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-br ${gradientClass} px-6 text-center text-white`}
        style={{
          paddingTop: "max(1.5rem, env(safe-area-inset-top))",
          paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
        }}
      >
        <QuizBackdrop />
        <div className="quiz-fade-in-up text-4xl">⚠️</div>
        <p className="quiz-fade-in-up mt-3 text-sm font-medium text-white/90">{errorMsg}</p>
        <button
          onClick={loadInitial}
          className="mt-5 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-ink shadow-md transition hover:scale-105 hover:shadow-lg active:scale-95"
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (finished || (!current && !fetchingMore)) {
    return (
      <div
        className={`relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-br ${gradientClass} px-6 text-center text-white`}
        style={{
          paddingTop: "max(1.5rem, env(safe-area-inset-top))",
          paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
        }}
      >
        <QuizBackdrop />
        {accuracy >= 70 &&
          confettiPieces.map((p, i) => (
            <span
              key={i}
              className="quiz-float-up pointer-events-none absolute bottom-10"
              style={{ left: `${p.left}%`, fontSize: p.size, animationDelay: `${p.delay}ms` }}
            >
              {p.emoji}
            </span>
          ))}

        <div className="quiz-fade-in-up flex flex-col items-center">
          <ScoreRing percent={accuracy} />
          <div className="mt-4 text-4xl">{accuracy >= 70 ? "🎉" : "💪"}</div>
          <h1 className="mt-2 text-2xl font-bold">Kết quả</h1>
          <p className="mt-2 text-lg font-semibold">
            {score}/{answered} câu đúng
          </p>
          <p className="mt-1 text-sm text-white/80">Chuỗi đúng liên tiếp cao nhất: {bestStreak} 🔥</p>

          <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
            <button
              onClick={() => setSessionKey((k) => k + 1)}
              className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-ink shadow-md transition hover:scale-[1.03] hover:shadow-lg active:scale-95"
            >
              🔁 Làm lại
            </button>
            <Link
              href={`/grammar/${lang}/test`}
              className="rounded-full border-2 border-white/70 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/10 active:scale-95"
            >
              Đổi chế độ
            </Link>
            <Link
              href="/"
              className="rounded-full px-5 py-3 text-center text-sm font-semibold text-white/80 transition hover:text-white"
            >
              Về trang chủ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div
        className={`relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-br ${gradientClass} px-6 text-center text-white`}
        style={{
          paddingTop: "max(1.5rem, env(safe-area-inset-top))",
          paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
        }}
      >
        <QuizBackdrop />
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/25 border-t-white" />
        <p className="mt-4 text-sm font-medium text-white/90">Đang tải thêm câu hỏi...</p>
      </div>
    );
  }

  const correctOption = current.options.find((o) => o.correct);
  const showResult = selectedOptionId !== null;
  const answeredCorrectly = showResult && selectedOptionId === correctOption?.id;
  const speakText = current.mode === "meaning" ? current.answerPattern : current.promptLabel;

  return (
    <div
      className={`relative flex min-h-dvh flex-col overflow-hidden bg-gradient-to-br ${gradientClass} px-4 text-white`}
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      <QuizBackdrop />

      <div className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-y-auto">
        {/* HUD */}
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/grammar/${lang}/test`}
            aria-label="Quay lại"
            className="rounded-full bg-white/15 px-3 py-1.5 text-sm backdrop-blur-sm transition hover:bg-white/25 active:scale-95"
          >
            ←
          </Link>
          <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs font-semibold">
            <span className="rounded-full bg-white/15 px-2.5 py-1 backdrop-blur-sm">
              {LANG_FLAG[current.language]} {MODE_LABEL[mode]}
            </span>
            <span className="rounded-full bg-white/15 px-2.5 py-1 backdrop-blur-sm">Câu {index + 1}</span>
            <span className="rounded-full bg-white/15 px-2.5 py-1 backdrop-blur-sm">
              ✔️ {score}/{answered}
            </span>
            {streak > 1 && (
              <span className="quiz-pop rounded-full bg-white/15 px-2.5 py-1 backdrop-blur-sm">🔥 {streak}</span>
            )}
          </div>
          <button
            onClick={() => setFinished(true)}
            className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm transition hover:bg-white/25 active:scale-95"
          >
            Dừng
          </button>
        </div>

        {reflex && (
          <div className="mt-3 flex shrink-0 items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/20">
              <div
                className={`h-full rounded-full transition-[width,background-color] duration-1000 ease-linear ${timerColor}`}
                style={{ width: `${Math.max(0, timerFraction) * 100}%` }}
              />
            </div>
            <span className="w-8 shrink-0 text-right text-sm font-bold tabular-nums">{timeLeft}s</span>
          </div>
        )}

        <p className="relative mt-3 shrink-0 text-center text-xs font-medium text-white/70">
          {QUESTION_COPY[mode]}
        </p>

        {/* Câu hỏi */}
        <div
          key={current.id}
          className="quiz-fade-in-up relative flex min-h-0 flex-1 flex-col items-center justify-center px-2 py-3 text-center"
        >
          <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-52 w-52 rounded-full bg-white/10 blur-2xl sm:h-64 sm:w-64" />
          </div>
          {current.promptSubLabel && (
            <div className="relative text-xs font-medium uppercase tracking-wide text-white/60">
              {current.promptSubLabel}
            </div>
          )}
          <div className="relative mt-2 flex items-center justify-center gap-2">
            <div className="text-2xl font-bold leading-snug sm:text-3xl md:text-4xl">
              {current.promptLabel}
            </div>
            <button
              onClick={() => speak(speakText, current.language)}
              aria-label="Nghe phát âm"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-base backdrop-blur-sm transition hover:bg-white/25 active:scale-95"
            >
              🔊
            </button>
          </div>
          {current.promptTranslationVn && (
            <div className="relative mt-2 max-w-md text-sm italic text-white/80">
              {current.promptTranslationVn}
            </div>
          )}
        </div>

        {/* Phản hồi đúng/sai */}
        <div aria-live="polite" className="mb-2 min-h-[2rem] shrink-0 text-center">
          {showResult && (
            <span
              className={`quiz-fade-in-up inline-block rounded-full px-4 py-1.5 text-sm font-semibold ${
                answeredCorrectly ? "bg-emerald-400/90 text-emerald-950" : "bg-red-400/90 text-white"
              }`}
            >
              {answeredCorrectly ? "✅ Chính xác!" : `❌ Đáp án đúng: ${correctOption?.label}`}
            </span>
          )}
        </div>

        {/* Đáp án */}
        <div className="flex shrink-0 flex-col gap-2.5">
          {current.options.map((option, i) => {
            const isPicked = selectedOptionId === option.id;
            const isTheCorrectOne = option.id === correctOption?.id;

            const stateClass = !showResult
              ? "bg-white/95 text-ink hover:bg-white hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98]"
              : isTheCorrectOne
                ? "quiz-pop bg-emerald-500 text-white"
                : isPicked
                  ? "quiz-shake bg-red-500 text-white"
                  : "bg-white/40 text-ink/60";

            return (
              <button
                key={option.id}
                onClick={() => handleAnswer(option.id)}
                disabled={showResult}
                className={`rounded-2xl px-4 py-3.5 text-left text-[15px] font-semibold shadow-md transition-all duration-200 sm:px-5 sm:py-4 sm:text-base ${stateClass}`}
              >
                <span className="mr-2 opacity-60">{String.fromCharCode(65 + i)}.</span>
                {option.label}
                {showResult && isTheCorrectOne && <span className="ml-2">✓</span>}
                {showResult && isPicked && !isTheCorrectOne && <span className="ml-2">✗</span>}
              </button>
            );
          })}
        </div>

        {/* Chế độ "chờ xem giải thích": hiện đầy đủ cách chia/sắc thái/ví dụ/lỗi hay gặp/mẹo nhớ rồi
            chờ người dùng chủ động bấm sang câu kế — dừng lại lâu hơn để học sâu. */}
        {explainMode && showResult && (
          <div className="quiz-fade-in-up mt-3 shrink-0 rounded-2xl bg-white/95 p-4 text-left text-ink shadow-lg">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-brand-600">{current.answerPattern}</span>
              {current.answerFormationRule && (
                <span className="text-xs text-ink-muted">{current.answerFormationRule}</span>
              )}
            </div>
            <div className="mt-1 text-sm font-semibold text-ink">{current.answerMeaningVn}</div>
            <p className="mt-1.5 rounded-lg bg-surface-3 px-3 py-2 text-xs text-ink">{current.answerNuanceVn}</p>

            {current.answerExample && (
              <div className="mt-2 rounded-lg bg-surface px-3 py-2 text-sm">
                <div className="font-medium text-ink">{current.answerExample}</div>
                <div className="text-ink-muted">{current.answerExampleVn}</div>
                {current.answerExampleNote && (
                  <div className="mt-1 text-xs text-ink-muted italic">{current.answerExampleNote}</div>
                )}
              </div>
            )}

            {current.answerCommonMistakeVn && (
              <p className="mt-2 text-xs text-red-600">
                <span className="font-semibold">⚠️</span> {current.answerCommonMistakeVn}
              </p>
            )}

            <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              💡 {current.answerMnemonicVn}
            </div>

            <button
              onClick={goToNext}
              className="mt-4 w-full rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-105 active:scale-95"
            >
              Câu tiếp theo →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
