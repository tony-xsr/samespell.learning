"use client";

import { useCallback, useEffect, useState } from "react";
import HanziWordBoard from "@/components/writing/HanziWordBoard";
import type { WritingMode } from "@/components/writing/HanziCharBoard";
import { isHanChar } from "@/components/writing/hanziWriterSetup";
import { speak } from "@/lib/tts";

interface PracticeWord {
  id: string;
  headword: string;
  reading: string;
  meaningVn: string;
}

interface WritingSummary {
  practiced: number;
  mastered: number;
  weak: number;
}

type Source = "learned" | "random" | "weak";

const SOURCES: { id: Source; label: string }[] = [
  { id: "learned", label: "📚 Đã học" },
  { id: "random", label: "🎲 Ngẫu nhiên" },
  { id: "weak", label: "🔁 Chữ hay sai" },
];

/** Độ dài từ tối đa — người mới nên bắt đầu từ chữ đơn / từ 2 chữ, thành ngữ 4 chữ để sau. */
const LENGTHS: { max: number; label: string }[] = [
  { max: 1, label: "1 chữ" },
  { max: 2, label: "≤ 2 chữ" },
  { max: 4, label: "≤ 4 chữ" },
];

const BATCH = 20;

export default function WritingPractice() {
  const [source, setSource] = useState<Source>("learned");
  const [maxLen, setMaxLen] = useState(2);
  const [words, setWords] = useState<PracticeWord[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<WritingMode>("watch");
  const [session, setSession] = useState({ words: 0, perfect: 0 });
  const [wordDone, setWordDone] = useState<number | null>(null);
  const [summary, setSummary] = useState<WritingSummary | null>(null);
  const [custom, setCustom] = useState("");
  const [customText, setCustomText] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/writing/progress");
      if (res.ok) setSummary((await res.json()).summary);
    } catch {
      // thống kê chỉ để xem — lỗi thì ẩn đi
    }
  }, []);

  useEffect(() => {
    loadSummary();
    window.addEventListener("writing-progress-updated", loadSummary);
    return () => window.removeEventListener("writing-progress-updated", loadSummary);
  }, [loadSummary]);

  const load = useCallback(async (src: Source, len: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/writing/words?source=${src}&count=${BATCH}&maxLen=${len}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Không tải được danh sách từ.");
      // Nguồn trống (chưa học từ nào / chưa có chữ hay sai) → sang ngẫu nhiên, kèm lời giải thích
      if (data.words.length === 0 && src !== "random") {
        setNotice(
          src === "learned"
            ? "Chưa có từ đã học nào ở độ dài này — đang cho từ ngẫu nhiên. Ôn thẻ tiếng Trung trước để có từ đã học."
            : "Chưa có chữ nào viết sai — tuyệt! Đang cho từ ngẫu nhiên.",
        );
        setSource("random");
        return;
      }
      setWords(data.words);
      setTotal(data.total);
      setIndex(0);
      setWordDone(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(source, maxLen);
  }, [source, maxLen, load]);

  function pickSource(src: Source) {
    setNotice(null);
    setSource(src);
  }

  function nextWord() {
    setWordDone(null);
    if (index < words.length - 1) setIndex(index + 1);
    else load(source, maxLen);
  }

  function handleWordComplete(mistakes: number) {
    setWordDone(mistakes);
    setSession((s) => ({ words: s.words + 1, perfect: s.perfect + (mistakes === 0 ? 1 : 0) }));
  }

  const word = words[index];
  const chip = (active: boolean) =>
    `whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
      active ? "bg-ink text-surface" : "border border-border bg-surface text-ink-muted hover:bg-surface-3"
    }`;

  return (
    <div className="flex flex-col gap-4">
      {summary && summary.practiced > 0 && (
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { n: summary.practiced, label: "chữ đã luyện" },
            { n: summary.mastered, label: "chữ đã thuộc", title: "Viết theo trí nhớ không sai nét 2 lần liên tiếp" },
            { n: summary.weak, label: "chữ cần luyện lại", title: "Lần viết gần nhất còn sai nét" },
          ].map((s) => (
            <div key={s.label} title={s.title} className="rounded-2xl border border-border bg-surface-2 px-2 py-2">
              <div className="text-lg font-bold text-ink">{s.n}</div>
              <div className="text-[10px] text-ink-muted">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-3xl border border-border bg-surface-2 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            {SOURCES.map((s) => (
              <button key={s.id} onClick={() => pickSource(s.id)} className={chip(source === s.id)}>
                {s.label}
                {s.id === "weak" && summary?.weak ? ` (${summary.weak})` : ""}
              </button>
            ))}
          </div>
          {source !== "weak" && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-ink-muted">Độ dài:</span>
              {LENGTHS.map((l) => (
                <button key={l.max} onClick={() => setMaxLen(l.max)} className={chip(maxLen === l.max)}>
                  {l.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {notice && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            {notice}
          </p>
        )}

        {loading && <p className="mt-6 text-center text-sm text-ink-muted">Đang tải từ…</p>}
        {error && <p className="mt-6 text-center text-sm text-red-600">{error}</p>}

        {!loading && !error && word && (
          <div className="mt-4 flex flex-col items-center gap-3">
            <div className="flex w-full items-center justify-between text-[11px] text-ink-muted">
              <span>
                Từ {index + 1}/{words.length}
                {total != null && total > words.length ? ` · chọn từ ${total.toLocaleString("vi-VN")} từ` : ""}
              </span>
              {session.words > 0 && (
                <span>
                  Đã viết {session.words} · {session.perfect} không sai
                </span>
              )}
            </div>
            <div className="text-center">
              {/* Viết theo trí nhớ: chỉ cho nghĩa + pinyin, mặt chữ phải tự nhớ ra */}
              <div className="text-3xl font-bold text-ink">
                {mode === "recall" ? "？".repeat(Array.from(word.headword).length) : word.headword}
              </div>
              <div className="mt-1 flex items-center justify-center gap-2 text-sm text-ink-muted">
                <span>{word.reading}</span>
                <button
                  onClick={() => speak(word.headword, "zh")}
                  aria-label="Nghe phát âm"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface-3 text-xs hover:bg-surface"
                >
                  🔊
                </button>
              </div>
              {word.meaningVn && <div className="mt-1 text-base font-semibold text-brand-600">{word.meaningVn}</div>}
            </div>

            <HanziWordBoard text={word.headword} onWordComplete={handleWordComplete} onModeChange={setMode} />

            {wordDone != null && (
              <p className={`text-center text-sm font-semibold ${wordDone === 0 ? "text-emerald-600" : "text-amber-600"}`}>
                {wordDone === 0 ? "🎉 Viết đúng cả từ, không sai nét nào!" : `Xong · sai ${wordDone} nét — bấm ↺ Viết lại cho nhớ`}
              </p>
            )}
            <button
              onClick={nextWord}
              className="rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:brightness-105"
            >
              {index < words.length - 1 ? "Từ tiếp →" : "Lượt mới →"}
            </button>
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-border bg-surface-2 p-4 shadow-sm sm:p-5">
        <h3 className="text-sm font-semibold text-ink">Viết chữ bất kỳ</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const text = Array.from(custom).filter(isHanChar).join("");
            setCustomText(text || null);
          }}
          className="mt-2 flex gap-2"
        >
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Nhập chữ Hán, vd 你好 / 學習"
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          />
          <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-105">
            Xem
          </button>
        </form>
        {customText && (
          <div className="mt-4">
            <HanziWordBoard text={customText} />
          </div>
        )}
      </div>
    </div>
  );
}
