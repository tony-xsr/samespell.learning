"use client";

import { useMemo, useState } from "react";
import type { CognateGroup, CognatePair, CognatePairSet, CognateWord } from "@/lib/cognateStore";
import { speakLocale, ttsFailureMessage } from "@/lib/tts";
import { useClusterBrowser, type ClusterBrowserAccessors } from "@/lib/useClusterBrowser";
import ClusterBrowserShell from "@/components/clusters/ClusterBrowserShell";
import ViewModeToggle, { type ViewMode } from "@/components/ui/ViewModeToggle";

function WordBlock({
  word,
  flag,
  locale,
  name,
  tone,
  active,
}: {
  word: CognateWord;
  flag: string;
  locale: string;
  name: string;
  tone: "left" | "right";
  active?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);

  async function handleSpeak() {
    setError(null);
    const result = await speakLocale(word.headword, locale);
    if (!result.ok) setError(ttsFailureMessage(result.reason));
  }

  return (
    <div
      className={`rounded-xl border px-3.5 py-2.5 shadow-sm transition ${
        active ? "border-amber-500 bg-surface-2 ring-2 ring-amber-200" : "border-border-strong bg-surface-2"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            tone === "left" ? "bg-brand-100 text-brand-700" : "bg-accent-100 text-accent-700"
          }`}
        >
          {flag}
        </span>
        <span className="text-base font-medium text-ink">{word.headword}</span>
        <span className="text-xs italic text-ink-muted">{word.reading}</span>
        <button
          type="button"
          onClick={handleSpeak}
          className="ml-auto flex h-6 w-6 flex-none items-center justify-center rounded-full border border-border bg-surface-3 text-[11px] hover:bg-brand-50"
          aria-label={`Phát âm ${name}`}
        >
          🔊
        </button>
      </div>
      <p className="mt-1 text-xs italic text-ink-muted">{word.example}</p>
      <p className="mt-0.5 text-xs text-ink-muted">{word.exampleVn}</p>
      {error && <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

function PairCard({ pair, layout, onOpen }: { pair: CognatePair; layout: ViewMode; onOpen: () => void }) {
  const inner = (
    <>
      <span className="line-clamp-2 text-base font-medium text-ink">
        <span className="text-brand-600">{pair.a.headword}</span>
        <span className="mx-2 text-ink-muted">↔</span>
        <span className="text-accent-600">{pair.b.headword}</span>
      </span>
      <span className="mt-1 line-clamp-1 text-xs text-ink-muted">{pair.meaningVn}</span>
    </>
  );
  if (layout === "grid") {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex h-full w-full flex-col items-start gap-1 rounded-2xl border border-border bg-surface-2 p-3 text-left shadow-sm transition hover:border-amber-300 hover:shadow-md"
      >
        {inner}
        <span className="mt-auto self-end text-amber-500">⛶</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full flex-col items-start gap-1 rounded-2xl border border-border bg-surface-2 px-4 py-3 text-left shadow-sm transition hover:border-amber-300 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
    >
      {inner}
      <span className="flex-none text-amber-500">⛶</span>
    </button>
  );
}

function PairDetailPanel({
  pair,
  pairSet,
  zoom,
  highlightIndex,
}: {
  pair: CognatePair;
  pairSet: CognatePairSet;
  zoom: number;
  highlightIndex?: number;
}) {
  return (
    <div className="flex h-full flex-col justify-center overflow-auto p-6 sm:p-10">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3" style={{ zoom }}>
        <WordBlock
          word={pair.a}
          flag={pairSet.flagA}
          locale={pairSet.localeA}
          name={pairSet.nameA}
          tone="left"
          active={highlightIndex === 0}
        />
        <div className="flex items-center justify-center gap-2 text-ink-muted">
          <span className="h-px flex-1 bg-border" />
          <span className="rounded-full border border-border-strong bg-surface-2 px-3 py-1 text-xs font-bold shadow-sm">
            ↔ cùng gốc từ
          </span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <WordBlock
          word={pair.b}
          flag={pairSet.flagB}
          locale={pairSet.localeB}
          name={pairSet.nameB}
          tone="right"
          active={highlightIndex === 1}
        />
        <p className="mt-1 text-center text-sm font-medium text-ink">{pair.meaningVn}</p>
        <p className="rounded-xl bg-surface-3/60 p-3 text-center text-xs text-ink-muted">{pair.mnemonicVn}</p>
      </div>
    </div>
  );
}

function GroupSection({ group, viewMode, onOpenPair }: {
  group: CognateGroup;
  viewMode: ViewMode;
  onOpenPair: (pairId: string) => void;
}) {
  const listClass =
    viewMode === "grid" ? "grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-2";
  return (
    <section className="rounded-2xl border border-border bg-surface-2/40 p-4">
      <div className="mb-1 flex flex-wrap items-baseline gap-2">
        <h2 className="text-lg font-bold text-ink">{group.root}</h2>
        <span className="text-xs text-ink-muted">gốc Latin: {group.latinOrigin}</span>
      </div>
      <p className="mb-3 text-xs text-ink-muted">{group.note}</p>
      <div className={listClass}>
        {group.pairs.map((pair) => (
          <div key={pair.id} className="relative h-full">
            <PairCard pair={pair} layout={viewMode} onOpen={() => onOpenPair(pair.id)} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function CognateBrowser({ pairSet }: { pairSet: CognatePairSet }) {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const flatPairs = useMemo(() => pairSet.groups.flatMap((g) => g.pairs), [pairSet]);

  const accessors = useMemo<ClusterBrowserAccessors>(
    () => ({
      count: flatPairs.length,
      idAt: (i) => flatPairs[i]?.id,
      wordsAt: (i) => {
        const p = flatPairs[i];
        if (!p) return [];
        return [
          { headword: p.a.headword, meaningVn: p.meaningVn, locale: pairSet.localeA },
          { headword: p.b.headword, meaningVn: p.meaningVn, locale: pairSet.localeB },
        ];
      },
    }),
    [flatPairs, pairSet.localeA, pairSet.localeB],
  );

  const ui = useClusterBrowser("es", accessors);
  const openPair = ui.openIndex !== null ? flatPairs[ui.openIndex] : undefined;
  const highlight = ui.autoPlaying ? ui.autoPlayWordIndex ?? undefined : undefined;

  function openPairById(pairId: string) {
    const idx = flatPairs.findIndex((p) => p.id === pairId);
    if (idx >= 0) ui.open(idx);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <ViewModeToggle mode={viewMode} onChange={setViewMode} />
      </div>
      {pairSet.groups.map((group) => (
        <GroupSection key={group.id} group={group} viewMode={viewMode} onOpenPair={openPairById} />
      ))}

      <ClusterBrowserShell ui={ui}>
        {openPair && (
          <PairDetailPanel key={openPair.id} pair={openPair} pairSet={pairSet} zoom={ui.zoom} highlightIndex={highlight} />
        )}
      </ClusterBrowserShell>
    </div>
  );
}
