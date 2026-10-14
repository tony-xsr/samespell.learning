"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import StrokeOrderStrip from "@/components/writing/StrokeOrderStrip";
import { isHanChar, loadHanziWriter } from "@/components/writing/hanziWriterSetup";
import { toPinyin } from "@/lib/zhPinyin";

const CELLS_PER_ROW = 8;
/** Số ô đầu hàng 1 có chữ mờ để tô — phần còn lại để trống tự viết. */
const TRACE_CELLS = 4;
const CELL = 64;

/** Một ô 田字格 khi in; có `strokes` thì vẽ chữ mờ bên trong để tô theo. */
function Cell({ strokes, opacity }: { strokes?: string[] | null; opacity: number }) {
  return (
    <svg width={CELL} height={CELL} viewBox="0 0 1024 1024" className="block">
      <rect x="4" y="4" width="1016" height="1016" fill="none" stroke="#9ca3af" strokeWidth="8" />
      <g stroke="#d1d5db" strokeWidth="5" strokeDasharray="30 22">
        <line x1="512" y1="0" x2="512" y2="1024" />
        <line x1="0" y1="512" x2="1024" y2="512" />
        <line x1="0" y1="0" x2="1024" y2="1024" />
        <line x1="1024" y1="0" x2="0" y2="1024" />
      </g>
      {strokes && (
        <g transform="scale(1,-1) translate(0,-900)">
          {strokes.map((d, i) => (
            <path key={i} d={d} fill="#000" fillOpacity={opacity} />
          ))}
        </g>
      )}
    </svg>
  );
}

function CharBlock({ char }: { char: string }) {
  const [strokes, setStrokes] = useState<string[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadHanziWriter()
      .then((HanziWriter) => HanziWriter.loadCharacterData(char))
      .then((data) => {
        if (!cancelled && data) setStrokes(data.strokes);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [char]);

  return (
    <div className="break-inside-avoid border-b border-gray-200 py-3">
      <div className="mb-2 flex items-start gap-3">
        <div className="w-14 shrink-0 text-center">
          <div className="text-4xl leading-none">{char}</div>
          <div className="mt-1 text-xs text-gray-500">{toPinyin(char)}</div>
        </div>
        <div className="min-w-0 flex-1 text-gray-900">
          <StrokeOrderStrip char={char} frameSize={34} wrap printable />
        </div>
      </div>
      {[0, 1].map((row) => (
        <div key={row} className="flex">
          {Array.from({ length: CELLS_PER_ROW }, (_, i) => (
            <Cell
              key={i}
              strokes={row === 0 && i < TRACE_CELLS ? strokes : null}
              // Ô đầu đậm hơn (mẫu), các ô sau nhạt dần để tự viết là chính
              opacity={i === 0 ? 0.35 : 0.15}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Giấy tập viết in ra được: mỗi chữ = bảng thứ tự nét + 1 hàng tô chữ mờ + 1 hàng ô trống. Luôn nền
 * trắng chữ đen bất kể giao diện sáng/tối, để in không tốn mực. */
export default function WritingSheet({ text }: { text: string }) {
  const [input, setInput] = useState(text);
  const chars = useMemo(() => Array.from(input).filter(isHanChar), [input]);

  return (
    <main className="min-h-dvh bg-white px-4 py-6 text-gray-900 print:p-0">
      <div className="mx-auto w-full max-w-[600px]">
        <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
          <Link href="/writing" className="text-sm font-medium text-violet-600 hover:underline">
            ← Luyện viết
          </Link>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Chữ Hán cần in"
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          />
          <button
            onClick={() => window.print()}
            disabled={chars.length === 0}
            className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            🖨️ In
          </button>
        </div>

        <h1 className="text-lg font-bold">Giấy tập viết chữ Hán</h1>
        <p className="mb-2 text-xs text-gray-500">
          Hàng 1: tô theo chữ mờ · Hàng 2: tự viết · Số dưới mỗi hình = thứ tự nét (nét đỏ là nét mới)
        </p>
        {chars.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500 print:hidden">Nhập chữ Hán ở trên để tạo giấy tập viết.</p>
        ) : (
          chars.map((c, i) => <CharBlock key={`${c}-${i}`} char={c} />)
        )}
      </div>
    </main>
  );
}
