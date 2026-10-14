"use client";

import { useEffect, useState } from "react";
import { loadHanziWriter } from "@/components/writing/hanziWriterSetup";

/** Bảng thứ tự nét kiểu sách tập viết: khung thứ k vẽ nét 1…k, nét k (nét mới) tô đỏ, nét chưa viết mờ.
 * Nhìn 1 lượt là thấy cả thứ tự — bổ sung cho animation (phải ngồi xem) và dùng được khi in.
 * Vẽ thẳng từ dữ liệu nét của hanzi-writer (path trong hệ toạ độ 1024, trục y hướng lên). */
export default function StrokeOrderStrip({
  char,
  frameSize = 44,
  wrap = false,
  printable = false,
}: {
  char: string;
  frameSize?: number;
  /** true = xuống dòng (dùng khi in); false = 1 hàng cuộn ngang. */
  wrap?: boolean;
  /** Màu cố định trắng/đen cho giấy in (không theo giao diện sáng/tối). */
  printable?: boolean;
}) {
  const [strokes, setStrokes] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStrokes(null);
    setFailed(false);
    (async () => {
      try {
        const HanziWriter = await loadHanziWriter();
        const data = await HanziWriter.loadCharacterData(char);
        if (!cancelled) {
          if (data) setStrokes(data.strokes);
          else setFailed(true);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [char]);

  if (failed) return null;
  if (!strokes) return <div style={{ height: frameSize + 14 }} />;

  return (
    // Căn giữa bằng justify-center sẽ cắt mất đầu dải khi tràn (chữ nhiều nét, không cuộn tới được) — dùng w-fit + mx-auto
    <div className={wrap ? "flex flex-wrap gap-1" : "mx-auto flex w-fit max-w-full gap-1 overflow-x-auto pb-1"}>
      {strokes.map((_, k) => (
        <div key={k} className="flex shrink-0 flex-col items-center">
          <svg
            width={frameSize}
            height={frameSize}
            viewBox="0 0 1024 1024"
            className={printable ? "rounded border border-gray-300 bg-white text-gray-900" : "rounded border border-border bg-surface text-ink"}
          >
            <g stroke="currentColor" strokeOpacity="0.12" strokeDasharray="24 24" strokeWidth="6">
              <line x1="512" y1="0" x2="512" y2="1024" />
              <line x1="0" y1="512" x2="1024" y2="512" />
            </g>
            {/* y lật: dữ liệu có gốc ở đường chân chữ, trục y hướng lên (y ∈ [-124, 900]) */}
            <g transform="scale(1,-1) translate(0,-900)">
              {strokes.map((d, i) => (
                <path
                  key={i}
                  d={d}
                  fill={i === k ? "#e11d48" : "currentColor"}
                  fillOpacity={i < k ? 0.9 : i === k ? 1 : 0.12}
                />
              ))}
            </g>
          </svg>
          <span className={`text-[9px] leading-tight ${printable ? "text-gray-500" : "text-ink-muted"}`}>{k + 1}</span>
        </div>
      ))}
    </div>
  );
}
