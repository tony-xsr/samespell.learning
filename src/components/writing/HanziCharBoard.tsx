"use client";

import { useEffect, useRef, useState } from "react";
import TianGrid from "@/components/writing/TianGrid";
import StrokeOrderStrip from "@/components/writing/StrokeOrderStrip";
import { cssColorToHex, loadHanziWriter, type WriterInstance } from "@/components/writing/hanziWriterSetup";

/** watch = xem animation thứ tự nét; trace = tô theo nét mờ; recall = viết theo trí nhớ (ô trống). */
export type WritingMode = "watch" | "trace" | "recall";

const SPEEDS = [0.5, 1, 2] as const;

/** Một ô viết cho MỘT chữ. Ở trace/recall, hanzi-writer chấm từng nét người học vẽ (đúng nét, đúng thứ tự,
 * đúng chiều); sai quá số lần thì tự nháy gợi ý nét cần viết. */
export default function HanziCharBoard({
  char,
  mode,
  size = 240,
  onComplete,
}: {
  char: string;
  mode: WritingMode;
  size?: number;
  /** Gọi khi viết xong chữ ở trace/recall, kèm tổng số nét viết sai. */
  onComplete?: (mistakes: number) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<WriterInstance | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [strokeCount, setStrokeCount] = useState(0);
  /** watch: số nét đã hiện ở chế độ "từng nét"; trace/recall: số nét đã viết đúng. */
  const [step, setStep] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [done, setDone] = useState(false);
  const [looping, setLooping] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    host.innerHTML = "";
    setStatus("loading");
    setStep(0);
    setMistakes(0);
    setDone(false);
    setLooping(false);

    (async () => {
      const HanziWriter = await loadHanziWriter();
      if (cancelled) return;
      const ink = cssColorToHex(getComputedStyle(host).color);
      const writer = HanziWriter.create(host, char, {
        width: size,
        height: size,
        padding: Math.round(size * 0.06),
        showOutline: mode !== "recall",
        showCharacter: mode === "watch",
        strokeColor: ink,
        drawingColor: ink,
        drawingWidth: Math.max(4, Math.round(size / 36)),
        outlineColor: "rgba(148, 163, 184, 0.4)",
        highlightColor: "#f59e0b",
        // Bộ thủ tô đỏ khi xem — nhìn ra chữ ghép từ bộ nào
        radicalColor: mode === "watch" ? "#e11d48" : null,
        strokeAnimationSpeed: speed,
        delayBetweenStrokes: Math.round(300 / speed),
        onLoadCharDataError: () => {
          if (!cancelled) setStatus("error");
        },
      });
      writerRef.current = writer;
      const data = await writer.getCharacterData().catch(() => null);
      if (cancelled) return;
      if (!data) {
        setStatus("error");
        return;
      }
      setStrokeCount(data.strokes.length);
      setStatus("ready");

      if (mode === "watch") {
        writer.animateCharacter();
        return;
      }
      writer.quiz({
        showHintAfterMisses: mode === "trace" ? 2 : 3,
        onCorrectStroke: (s) => setStep(s.strokeNum + 1),
        onMistake: (s) => setMistakes(s.totalMistakes),
        onComplete: ({ totalMistakes }) => {
          setMistakes(totalMistakes);
          setDone(true);
          onCompleteRef.current?.(totalMistakes);
        },
      });
    })();

    return () => {
      cancelled = true;
      try {
        writerRef.current?.cancelQuiz();
      } catch {
        // chưa vào quiz — không có gì để huỷ
      }
      writerRef.current = null;
      host.innerHTML = "";
    };
  }, [char, mode, size, speed, attempt]);

  const writer = writerRef.current;

  function play() {
    if (!writer) return;
    setLooping(false);
    setStep(0);
    writer.showOutline();
    writer.animateCharacter();
  }

  async function toggleLoop() {
    if (!writer) return;
    if (looping) {
      setLooping(false);
      await writer.pauseAnimation();
      writer.showCharacter();
      return;
    }
    setLooping(true);
    setStep(0);
    writer.loopCharacterAnimation();
  }

  /** Hiện thêm đúng 1 nét mỗi lần bấm — xem chậm nét nào trước, nét nào sau. */
  async function nextStroke() {
    if (!writer || strokeCount === 0) return;
    if (looping) {
      setLooping(false);
      await writer.pauseAnimation();
    }
    if (step >= strokeCount) {
      setStep(0);
      writer.showCharacter();
      return;
    }
    if (step === 0) await writer.hideCharacter({ duration: 0 });
    setStep(step + 1);
    writer.animateStroke(step);
  }

  function hint() {
    if (!writer || done) return;
    writer.highlightStroke(step);
  }

  const btn =
    "whitespace-nowrap rounded-full border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-surface-3 disabled:opacity-40";

  return (
    // w-full + min-w-0: không để dải thứ tự nét (chữ nhiều nét) kéo khung rộng ra ngoài màn hình
    <div className="flex w-full min-w-0 flex-col items-center gap-2">
      <div className="relative text-ink" style={{ width: size, height: size }}>
        <TianGrid size={size} />
        <div ref={hostRef} className="relative touch-none" style={{ width: size, height: size }} />
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-ink-muted">Đang tải nét…</div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-4 text-center text-xs text-ink-muted">
            <span className="text-4xl text-ink">{char}</span>
            Chưa có dữ liệu nét cho chữ này (hoặc mất mạng).
          </div>
        )}
      </div>

      <div className="text-xs text-ink-muted">
        {status === "ready" &&
          (mode === "watch"
            ? step > 0
              ? `Nét ${step}/${strokeCount}`
              : `${strokeCount} nét · bộ thủ tô đỏ`
            : done
              ? mistakes === 0
                ? "✅ Hoàn hảo — không sai nét nào!"
                : `✅ Xong · sai ${mistakes} lần`
              : `Nét ${step + 1}/${strokeCount}${mistakes > 0 ? ` · sai ${mistakes}` : ""}`)}
      </div>

      {status === "ready" && (
        <div className="flex items-center justify-center gap-1.5">
          {mode === "watch" ? (
            <>
              <button onClick={play} className={btn} title="Xem lại animation cả chữ">
                ▶ Xem
              </button>
              <button onClick={nextStroke} className={btn} title="Mỗi lần bấm hiện thêm 1 nét">
                {step >= strokeCount && step > 0 ? "↺ Cả chữ" : "⏭ Từng nét"}
              </button>
              <button onClick={toggleLoop} className={btn}>
                {looping ? "⏸ Dừng" : "🔁 Lặp"}
              </button>
              <button
                onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
                className={btn}
                title="Tốc độ animation"
              >
                {speed}×
              </button>
            </>
          ) : (
            <>
              <button onClick={hint} disabled={done} className={btn} title="Nháy sáng nét cần viết tiếp">
                💡 Gợi ý nét
              </button>
              <button onClick={() => setAttempt((a) => a + 1)} className={btn}>
                ↺ Viết lại
              </button>
            </>
          )}
        </div>
      )}

      {mode === "watch" && status === "ready" && (
        <div className="w-full max-w-full">
          <div className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
            Thứ tự nét
          </div>
          <StrokeOrderStrip char={char} />
        </div>
      )}
    </div>
  );
}
