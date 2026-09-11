"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Language } from "@/types/vocab";
import type { AntonymRoot, CharAntonymLanguageData, CharAntonymPair, ClusterWord } from "@/types/wordCluster";
import { speak, ttsFailureMessage } from "@/lib/tts";
import { useClusterBrowser, type ClusterBrowserAccessors } from "@/lib/useClusterBrowser";
import ClusterBrowserShell from "@/components/clusters/ClusterBrowserShell";
import ViewModeToggle, { type ViewMode } from "@/components/ui/ViewModeToggle";

function WordCard({
  word,
  language,
  tone,
  active,
}: {
  word: ClusterWord;
  language: Language;
  tone: "left" | "right";
  active?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [active]);

  async function handleSpeak() {
    setError(null);
    const result = await speak(word.headword, language);
    if (!result.ok) setError(ttsFailureMessage(result.reason));
  }
  return (
    <div
      ref={ref}
      className={`rounded-xl border px-3.5 py-2.5 shadow-sm transition ${
        active ? "border-amber-500 bg-surface-2 ring-2 ring-amber-200" : "border-border-strong bg-surface-2"
      }`}
    >
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

function RootColumn({
  root,
  language,
  tone,
  activeWordIndex,
}: {
  root: AntonymRoot;
  language: Language;
  tone: "left" | "right";
  activeWordIndex?: number;
}) {
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
          <WordCard key={i} word={w} language={language} tone={tone} active={activeWordIndex === i} />
        ))}
      </div>
    </div>
  );
}

function PairCard({ pair, layout, onOpen }: { pair: CharAntonymPair; layout: ViewMode; onOpen: () => void }) {
  if (layout === "grid") {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex h-full w-full flex-col items-start gap-2 rounded-2xl border border-border bg-surface-2 p-3 text-left shadow-sm transition hover:border-amber-300 hover:shadow-md"
      >
        <span className="hanzi line-clamp-2 text-base font-medium text-ink">
          <span className="text-brand-600">{pair.left.character}</span>
          <span className="mx-2 text-ink-muted">⇔</span>
          <span className="text-accent-600">{pair.right.character}</span>
        </span>
        <span className="mt-auto flex w-full items-center justify-between gap-2">
          <span className="text-[11px] text-ink-muted">{pair.left.words.length + pair.right.words.length} từ</span>
          <span className="flex-none text-amber-500">⛶</span>
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
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
  );
}

/** Panel chi tiết cặp chữ trái nghĩa. `highlightIndex` đánh số trên danh sách phẳng
 * `[...left.words, ...right.words]` để khớp thứ tự vòng lặp tự động đọc. */
function PairDetailPanel({
  pair,
  language,
  zoom,
  highlightIndex,
}: {
  pair: CharAntonymPair;
  language: Language;
  zoom: number;
  highlightIndex?: number;
}) {
  const leftCount = pair.left.words.length;
  const leftActive = highlightIndex !== undefined && highlightIndex < leftCount ? highlightIndex : undefined;
  const rightActive =
    highlightIndex !== undefined && highlightIndex >= leftCount ? highlightIndex - leftCount : undefined;
  return (
    <div className="flex h-full flex-col justify-center overflow-auto p-6 sm:p-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col" style={{ zoom }}>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-[1fr_auto_1fr] sm:items-start">
          <RootColumn root={pair.left} language={language} tone="left" activeWordIndex={leftActive} />
          <div className="flex flex-row items-center justify-center gap-2 text-ink-muted sm:flex-col sm:self-stretch">
            <span className="h-px flex-1 bg-border sm:h-full sm:w-px sm:flex-none" />
            <span className="rounded-full border border-border-strong bg-surface-2 px-3 py-1 text-xs font-bold shadow-sm">
              ⇔ trái nghĩa
            </span>
            <span className="h-px flex-1 bg-border sm:h-full sm:w-px sm:flex-none" />
          </div>
          <RootColumn root={pair.right} language={language} tone="right" activeWordIndex={rightActive} />
        </div>

        <p className="mt-5 text-center text-sm text-ink-muted">{pair.note}</p>
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
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const pairs = data.pairs;

  const accessors = useMemo<ClusterBrowserAccessors>(
    () => ({
      count: pairs.length,
      idAt: (i) => pairs[i]?.id,
      wordsAt: (i) => {
        const p = pairs[i];
        if (!p) return [];
        return [...p.left.words, ...p.right.words].map((w) => ({ headword: w.headword, meaningVn: w.meaningVn }));
      },
    }),
    [pairs],
  );

  const ui = useClusterBrowser(language, accessors);

  const listClass = viewMode === "grid" ? "grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-2";

  const openPair = ui.openIndex !== null ? pairs[ui.openIndex] : undefined;
  const highlight = ui.autoPlaying ? ui.autoPlayWordIndex ?? undefined : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <ViewModeToggle mode={viewMode} onChange={setViewMode} />
      </div>
      <div className={listClass}>
        {pairs.map((pair, i) => (
          <div key={pair.id} className="relative h-full">
            {ui.bookmarkedIds.has(pair.id) && (
              <span className="absolute right-2 top-2 z-10 text-amber-500" aria-hidden>
                ★
              </span>
            )}
            {ui.masteredIds.has(pair.id) && (
              <span className="absolute left-2 top-2 z-10 text-emerald-500" aria-hidden>
                ✅
              </span>
            )}
            <PairCard pair={pair} layout={viewMode} onOpen={() => ui.open(i)} />
          </div>
        ))}
      </div>

      <ClusterBrowserShell ui={ui}>
        {openPair && (
          <PairDetailPanel
            key={openPair.id}
            pair={openPair}
            language={language}
            zoom={ui.zoom}
            highlightIndex={highlight}
          />
        )}
      </ClusterBrowserShell>
    </div>
  );
}
