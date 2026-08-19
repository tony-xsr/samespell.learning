"use client";

import { useEffect, useRef, useState } from "react";
import type { Language } from "@/types/vocab";
import type { AntonymRoot, CharAntonymLanguageData, CharAntonymPair, ClusterWord } from "@/types/wordCluster";
import { speak, ttsFailureMessage } from "@/lib/tts";

function WordCard({ word, language, tone }: { word: ClusterWord; language: Language; tone: "left" | "right" }) {
  const [error, setError] = useState<string | null>(null);
  async function handleSpeak() {
    setError(null);
    const result = await speak(word.headword, language);
    if (!result.ok) setError(ttsFailureMessage(result.reason));
  }
  return (
    <div className="rounded-xl border border-border-strong bg-surface-2 px-3.5 py-2.5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="hanzi text-lg font-medium text-ink">{word.headword}</span>
        {word.hanja && <span className="text-xs text-ink-muted">({word.hanja})</span>}
        <span className={`text-xs italic ${tone === "left" ? "text-brand-600" : "text-accent-600"}`}>
          {word.reading}
        </span>
        <button
          type="button"
          onClick={handleSpeak}
          className="ml-auto flex h-6 w-6 flex-none items-center justify-center rounded-full border border-border bg-surface-3 text-[11px] hover:bg-brand-50"
          aria-label="Phát âm"
        >
          🔊
        </button>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        <span className="font-semibold text-ink">{word.hanViet}</span> — {word.meaningVn}
      </p>
      {error && <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

function RootColumn({ root, language, tone }: { root: AntonymRoot; language: Language; tone: "left" | "right" }) {
  const bg = tone === "left" ? "bg-brand-600" : "bg-accent-600";
  return (
    <div className="flex flex-col items-center gap-2.5">
      <div className={`rounded-2xl px-6 py-3 text-center text-white shadow ${bg}`}>
        <div className="hanzi text-3xl">{root.character}</div>
        <div className="mt-0.5 text-xs opacity-90">
          {root.reading} · {root.hanViet}
        </div>
      </div>
      <div className="flex w-full flex-col gap-2">
        {root.words.map((w, i) => (
          <WordCard key={i} word={w} language={language} tone={tone} />
        ))}
      </div>
    </div>
  );
}

function PairCard({ pair, language }: { pair: CharAntonymPair; language: Language }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    function onFullscreenChange() {
      const active = document.fullscreenElement === containerRef.current;
      setIsFullscreen(active);
      if (!active) setZoom(1);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  function openFullscreen() {
    containerRef.current?.requestFullscreen().catch(() => {});
  }
  function closeFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
  }

  if (!isFullscreen) {
    return (
      <div ref={containerRef}>
        <button
          type="button"
          onClick={openFullscreen}
          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3 text-left shadow-sm transition hover:border-amber-300 hover:shadow-md"
        >
          <span className="hanzi flex-1 truncate text-base font-medium text-ink">
            <span className="text-brand-600">{pair.left.character}</span>
            <span className="mx-2 text-ink-muted">⇔</span>
            <span className="text-accent-600">{pair.right.character}</span>
          </span>
          <span className="flex-none text-[11px] text-ink-muted">
            {pair.left.words.length + pair.right.words.length} từ
          </span>
          <span className="flex-none text-amber-500">⛶</span>
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex h-full flex-col justify-center overflow-auto bg-surface p-6 sm:p-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col">
        <div className="mb-5 flex items-center justify-between gap-2">
          <span className="font-mono text-xs text-ink-muted">{pair.id}</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-2 text-sm text-ink hover:border-amber-300 hover:bg-surface-3"
              aria-label="Thu nhỏ"
            >
              −
            </button>
            <span className="w-11 text-center text-xs text-ink-muted">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.8, +(z + 0.1).toFixed(2)))}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-2 text-sm text-ink hover:border-amber-300 hover:bg-surface-3"
              aria-label="Phóng to"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-2 text-sm text-ink hover:border-amber-300 hover:bg-surface-3"
              aria-label="Về cỡ gốc"
            >
              ⟲
            </button>
            <button
              type="button"
              onClick={closeFullscreen}
              className="ml-1 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-2 text-sm text-ink hover:border-amber-300 hover:bg-surface-3"
              aria-label="Thoát toàn màn hình"
            >
              ⤢
            </button>
          </div>
        </div>

        <div style={{ zoom }}>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-[1fr_auto_1fr] sm:items-start">
            <RootColumn root={pair.left} language={language} tone="left" />
            <div className="flex flex-row items-center justify-center gap-2 text-ink-muted sm:flex-col sm:self-stretch">
              <span className="h-px flex-1 bg-border sm:h-full sm:w-px sm:flex-none" />
              <span className="rounded-full border border-border-strong bg-surface-2 px-3 py-1 text-xs font-bold shadow-sm">
                ⇔ trái nghĩa
              </span>
              <span className="h-px flex-1 bg-border sm:h-full sm:w-px sm:flex-none" />
            </div>
            <RootColumn root={pair.right} language={language} tone="right" />
          </div>

          <p className="mt-5 text-center text-sm text-ink-muted">{pair.note}</p>
        </div>
      </div>
    </div>
  );
}

export default function CharAntonymBrowser({
  language,
  data,
}: {
  language: Language;
  data: CharAntonymLanguageData;
}) {
  return (
    <div className="flex flex-col gap-2">
      {data.pairs.map((pair) => (
        <PairCard key={pair.id} pair={pair} language={language} />
      ))}
    </div>
  );
}
