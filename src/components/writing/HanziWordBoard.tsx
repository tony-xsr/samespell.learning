"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import HanziCharBoard, { type WritingMode } from "@/components/writing/HanziCharBoard";
import { isHanChar, recordWritingAttempt } from "@/components/writing/hanziWriterSetup";

const MODES: { id: WritingMode; icon: string; short: string; label: string; hint: string }[] = [
  { id: "watch", icon: "👀", short: "Xem", label: "Xem cách viết", hint: "Xem animation thứ tự nét · ⏭ đi từng nét · bảng thứ tự nét ở dưới." },
  { id: "trace", icon: "✍️", short: "Tô", label: "Tô theo mẫu", hint: "Vẽ từng nét đè lên nét mờ — đúng thứ tự, đúng chiều." },
  { id: "recall", icon: "🧠", short: "Nhớ", label: "Viết theo trí nhớ", hint: "Ô trống — tự viết cả chữ; sai 3 lần sẽ nháy gợi ý." },
];

const MIN_SIZE = 200;

/** Luyện viết cả một từ: chữ nào trước chữ nấy, viết xong 1 chữ thì tự sang chữ kế. Mỗi chữ viết xong ở
 * chế độ tô / nhớ được ghi vào tiến độ luyện viết (để biết chữ nào hay sai, chữ nào đã thuộc). */
export default function HanziWordBoard({
  text,
  initialMode = "watch",
  maxSize = 300,
  onWordComplete,
  onModeChange,
}: {
  text: string;
  initialMode?: WritingMode;
  /** Ô viết tự co theo chiều rộng khung chứa, tối đa chừng này px. */
  maxSize?: number;
  /** Viết xong mọi chữ của từ (trace/recall) — tổng số nét sai. */
  onWordComplete?: (mistakes: number) => void;
  onModeChange?: (mode: WritingMode) => void;
}) {
  const chars = useMemo(() => Array.from(text).filter(isHanChar), [text]);
  const [mode, setMode] = useState<WritingMode>(initialMode);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Record<number, number>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(240);

  // Ô viết to hết cỡ khung chứa (điện thoại: gần full chiều ngang, dễ vẽ bằng ngón tay)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setSize(Math.max(MIN_SIZE, Math.min(maxSize, Math.floor(el.clientWidth))));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [maxSize]);

  useEffect(() => {
    setIndex(0);
    setResults({});
  }, [text, mode]);

  useEffect(() => {
    onModeChange?.(mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  if (chars.length === 0) {
    return <p className="text-center text-sm text-ink-muted">Không có chữ Hán nào để luyện viết.</p>;
  }

  function handleCharComplete(mistakes: number) {
    if (mode !== "watch") recordWritingAttempt(chars[index], mistakes, mode);
    const next = { ...results, [index]: mistakes };
    setResults(next);
    if (index < chars.length - 1) {
      setTimeout(() => setIndex((i) => i + 1), 700);
    } else if (Object.keys(next).length === chars.length) {
      onWordComplete?.(Object.values(next).reduce((a, b) => a + b, 0));
    }
  }

  const current = chars[Math.min(index, chars.length - 1)];

  return (
    <div ref={containerRef} className="flex w-full flex-col items-center gap-3">
      <div className="flex w-full max-w-sm rounded-full border border-border bg-surface p-0.5" role="tablist">
        {MODES.map((m) => (
          <button
            key={m.id}
            role="tab"
            aria-selected={mode === m.id}
            onClick={() => setMode(m.id)}
            className={`flex-1 whitespace-nowrap rounded-full px-2 py-1.5 text-xs font-semibold transition ${
              mode === m.id ? "bg-brand-600 text-white shadow-sm" : "text-ink-muted hover:text-ink"
            }`}
          >
            {m.icon} <span className="sm:hidden">{m.short}</span>
            <span className="hidden sm:inline">{m.label}</span>
          </button>
        ))}
      </div>
      <p className="text-center text-[11px] text-ink-muted">{MODES.find((m) => m.id === mode)?.hint}</p>

      {chars.length > 1 && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {chars.map((c, i) => {
            const r = results[i];
            return (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className={`flex h-10 min-w-10 flex-col items-center justify-center rounded-lg border px-2 text-lg leading-none ${
                  i === index ? "border-brand-600 bg-brand-600/10 text-ink" : "border-border bg-surface text-ink-muted"
                }`}
                title={r == null ? undefined : r === 0 ? "Không sai nét nào" : `Sai ${r} lần`}
              >
                {/* Viết theo trí nhớ thì không lộ mặt chữ chưa viết */}
                {mode === "recall" && r == null ? "？" : c}
                {r != null && (
                  <span className={`mt-0.5 text-[9px] font-bold ${r === 0 ? "text-emerald-600" : "text-amber-600"}`}>
                    {r === 0 ? "✓" : `✗${r}`}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <HanziCharBoard key={`${index}-${current}`} char={current} mode={mode} size={size} onComplete={handleCharComplete} />

      <Link
        href={`/writing/print?text=${encodeURIComponent(chars.join(""))}`}
        target="_blank"
        className="text-[11px] font-semibold text-brand-600 hover:underline"
      >
        🖨️ In giấy tập viết cho {chars.length > 1 ? "từ" : "chữ"} này
      </Link>
    </div>
  );
}
