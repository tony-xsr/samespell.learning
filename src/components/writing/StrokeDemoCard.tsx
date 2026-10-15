"use client";

import { useEffect, useRef, useState } from "react";
import TianGrid from "@/components/writing/TianGrid";
import { cssColorToHex, loadHanziWriter, type WriterInstance } from "@/components/writing/hanziWriterSetup";

/** Thẻ nhỏ minh hoạ 1 nét cơ bản / 1 quy tắc thứ tự nét. Có `strokeIndex` thì chỉ animate đúng nét đó
 * trên nền chữ mờ (nét 捺, 提… không có dữ liệu đứng riêng nên mượn chữ mẫu); không có thì animate cả chữ.
 * Bấm vào thẻ để xem lại. */
export default function StrokeDemoCard({
  char,
  strokeIndex,
  title,
  subtitle,
  size = 88,
}: {
  char: string;
  strokeIndex?: number;
  title: string;
  subtitle?: string;
  size?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<WriterInstance | null>(null);
  const [failed, setFailed] = useState(false);

  async function play() {
    const writer = writerRef.current;
    if (!writer) return;
    if (strokeIndex == null) {
      writer.animateCharacter();
      return;
    }
    await writer.hideCharacter({ duration: 0 });
    writer.animateStroke(strokeIndex);
  }

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    host.innerHTML = "";
    (async () => {
      const HanziWriter = await loadHanziWriter();
      if (cancelled) return;
      const ink = cssColorToHex(getComputedStyle(host).color);
      const writer = HanziWriter.create(host, char, {
        width: size,
        height: size,
        padding: Math.round(size * 0.08),
        showOutline: true,
        showCharacter: strokeIndex == null,
        strokeColor: strokeIndex == null ? ink : "#e11d48",
        outlineColor: "rgba(148, 163, 184, 0.45)",
        strokeAnimationSpeed: 0.8,
        delayBetweenStrokes: 350,
        onLoadCharDataError: () => {
          if (!cancelled) setFailed(true);
        },
      });
      writerRef.current = writer;
      await writer.getCharacterData().catch(() => setFailed(true));
      if (!cancelled) play();
    })();
    return () => {
      cancelled = true;
      writerRef.current = null;
      host.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [char, strokeIndex, size]);

  return (
    <button
      onClick={play}
      className="flex w-28 shrink-0 snap-start flex-col items-center gap-1 rounded-2xl border border-border bg-surface-2 p-2 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:w-auto"
      title="Bấm để xem lại"
    >
      <div className="relative text-ink" style={{ width: size, height: size }}>
        <TianGrid size={size} />
        <div ref={hostRef} className="relative" style={{ width: size, height: size }} />
        {failed && <div className="absolute inset-0 flex items-center justify-center text-3xl">{char}</div>}
      </div>
      <div className="text-xs font-semibold text-ink">{title}</div>
      {subtitle && <div className="text-[10px] leading-tight text-ink-muted">{subtitle}</div>}
    </button>
  );
}
