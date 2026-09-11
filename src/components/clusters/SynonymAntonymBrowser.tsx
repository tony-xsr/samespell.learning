"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Language } from "@/types/vocab";
import type {
  ClusterWord,
  SynonymAntonymLanguageData,
  SynonymAntonymPair,
  SynonymCluster,
} from "@/types/wordCluster";
import { speak, ttsFailureMessage } from "@/lib/tts";
import { useClusterBrowser, type ClusterBrowserAccessors } from "@/lib/useClusterBrowser";
import ClusterBrowserShell from "@/components/clusters/ClusterBrowserShell";
import ViewModeToggle, { type ViewMode } from "@/components/ui/ViewModeToggle";
import BrowserTabs from "@/components/ui/BrowserTabs";

function WordCard({
  word,
  language,
  tone,
  active,
}: {
  word: ClusterWord;
  language: Language;
  tone: "syn" | "ant";
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
        <span className={`text-xs italic ${tone === "syn" ? "text-brand-600" : "text-accent-600"}`}>
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

function PairCard({ pair, layout, onOpen }: { pair: SynonymAntonymPair; layout: ViewMode; onOpen: () => void }) {
  const synPreview = pair.synonymCluster.words.map((w) => w.headword).join("·");
  const antPreview = pair.antonymCluster.words.map((w) => w.headword).join("·");

  if (layout === "grid") {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex h-full w-full flex-col items-start gap-2 rounded-2xl border border-border bg-surface-2 p-3 text-left shadow-sm transition hover:border-amber-300 hover:shadow-md"
      >
        <span className="hanzi line-clamp-2 text-sm font-medium text-ink">
          <span className="text-brand-600">{synPreview}</span>
          <span className="mx-2 text-ink-muted">⇕</span>
          <span className="text-accent-600">{antPreview}</span>
        </span>
        <span className="mt-auto text-amber-500">⛶</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3 text-left shadow-sm transition hover:border-amber-300 hover:shadow-md"
    >
      <span className="hanzi flex-1 truncate text-sm font-medium text-ink">
        <span className="text-brand-600">{synPreview}</span>
        <span className="mx-2 text-ink-muted">⇕</span>
        <span className="text-accent-600">{antPreview}</span>
      </span>
      <span className="flex-none text-amber-500">⛶</span>
    </button>
  );
}

/** Panel chi tiết cặp đồng nghĩa ↔ trái nghĩa. `highlightIndex` đánh số trên danh sách phẳng
 * `[...synonymCluster.words, ...antonymCluster.words]` để khớp thứ tự vòng lặp tự động đọc. */
function PairDetailPanel({
  pair,
  language,
  zoom,
  highlightIndex,
}: {
  pair: SynonymAntonymPair;
  language: Language;
  zoom: number;
  highlightIndex?: number;
}) {
  const synCount = pair.synonymCluster.words.length;
  return (
    <div className="flex h-full flex-col justify-center overflow-auto p-6 sm:p-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col" style={{ zoom }}>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-bold uppercase tracking-wide text-brand-600">
              Cụm gần nghĩa{pair.synonymCluster.sharedChar ? ` — chung chữ ${pair.synonymCluster.sharedChar}` : ""}
            </span>
            {pair.synonymCluster.words.map((w, i) => (
              <WordCard key={i} word={w} language={language} tone="syn" active={highlightIndex === i} />
            ))}
          </div>

          <div className="flex flex-row items-center justify-center gap-2 text-ink-muted sm:flex-col">
            <span className="h-px flex-1 bg-border sm:h-16 sm:w-px sm:flex-none" />
            <span className="rounded-full border border-border-strong bg-surface-2 px-3 py-1 text-xs font-bold shadow-sm">
              ⇕ trái nghĩa
            </span>
            <span className="h-px flex-1 bg-border sm:h-16 sm:w-px sm:flex-none" />
          </div>

          <div className="flex flex-col gap-2.5">
            <span className="text-xs font-bold uppercase tracking-wide text-accent-600">
              Cụm trái nghĩa{pair.antonymCluster.sharedChar ? ` — chung chữ ${pair.antonymCluster.sharedChar}` : ""}
            </span>
            {pair.antonymCluster.words.map((w, i) => (
              <WordCard
                key={i}
                word={w}
                language={language}
                tone="ant"
                active={highlightIndex === synCount + i}
              />
            ))}
          </div>
        </div>

        <p className="mt-5 text-center text-sm text-ink-muted">{pair.note}</p>
      </div>
    </div>
  );
}

function SynClusterCard({ cluster, layout, onOpen }: { cluster: SynonymCluster; layout: ViewMode; onOpen: () => void }) {
  const preview = cluster.words.map((w) => w.headword).join(" · ");

  if (layout === "grid") {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex h-full w-full flex-col items-start gap-2 rounded-2xl border border-border bg-surface-2 p-3 text-left shadow-sm transition hover:border-amber-300 hover:shadow-md"
      >
        <span className="hanzi line-clamp-2 text-sm font-medium text-brand-600">{preview}</span>
        <span className="mt-auto flex w-full items-center justify-between gap-2">
          <span className="rounded-md bg-surface-3 px-2 py-0.5 text-[10px] font-bold text-ink-muted">
            cụm gần nghĩa
          </span>
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
      <span className="hanzi flex-1 truncate text-sm font-medium text-brand-600">{preview}</span>
      <span className="flex-none rounded-md bg-surface-3 px-2 py-0.5 text-[10px] font-bold text-ink-muted">
        cụm gần nghĩa
      </span>
      <span className="flex-none text-amber-500">⛶</span>
    </button>
  );
}

function SynClusterDetailPanel({
  cluster,
  language,
  zoom,
  highlightIndex,
}: {
  cluster: SynonymCluster;
  language: Language;
  zoom: number;
  highlightIndex?: number;
}) {
  return (
    <div className="flex h-full flex-col justify-center overflow-auto p-6 sm:p-10">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-2.5" style={{ zoom }}>
        <span className="text-xs font-bold uppercase tracking-wide text-brand-600">
          Cụm gần nghĩa{cluster.sharedChar ? ` — chung chữ ${cluster.sharedChar}` : ""}
        </span>
        {cluster.words.map((w, i) => (
          <WordCard key={i} word={w} language={language} tone="syn" active={highlightIndex === i} />
        ))}
        <p className="mt-2 text-center text-sm text-ink-muted">{cluster.note}</p>
      </div>
    </div>
  );
}

type SynTab = "pairs" | "clusters";

export default function SynonymAntonymBrowser({
  language,
  data,
}: {
  language: Language;
  data: SynonymAntonymLanguageData;
}) {
  const hasClusters = !!data.synonymClusters && data.synonymClusters.length > 0;
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [activeTab, setActiveTab] = useState<SynTab>("pairs");

  const pairs = data.pairs;
  const clusters = useMemo(() => data.synonymClusters ?? [], [data.synonymClusters]);
  const onPairs = !hasClusters || activeTab === "pairs";

  const accessors = useMemo<ClusterBrowserAccessors>(() => {
    if (onPairs) {
      return {
        count: pairs.length,
        idAt: (i) => pairs[i]?.id,
        wordsAt: (i) => {
          const p = pairs[i];
          if (!p) return [];
          return [...p.synonymCluster.words, ...p.antonymCluster.words].map((w) => ({
            headword: w.headword,
            meaningVn: w.meaningVn,
          }));
        },
      };
    }
    return {
      count: clusters.length,
      idAt: (i) => clusters[i]?.id,
      wordsAt: (i) => (clusters[i]?.words ?? []).map((w) => ({ headword: w.headword, meaningVn: w.meaningVn })),
    };
  }, [onPairs, pairs, clusters]);

  const ui = useClusterBrowser(language, accessors);

  const listClass = viewMode === "grid" ? "grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-2";

  const openPair = onPairs && ui.openIndex !== null ? pairs[ui.openIndex] : undefined;
  const openCluster = !onPairs && ui.openIndex !== null ? clusters[ui.openIndex] : undefined;
  const highlight = ui.autoPlaying ? ui.autoPlayWordIndex ?? undefined : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {hasClusters ? (
          <BrowserTabs
            tabs={[
              { id: "pairs", label: "⇕ Đồng nghĩa · trái nghĩa", count: data.pairs.length },
              { id: "clusters", label: "Cụm gần nghĩa", count: data.synonymClusters!.length },
            ]}
            activeId={activeTab}
            onChange={setActiveTab}
          />
        ) : (
          <span />
        )}
        <ViewModeToggle mode={viewMode} onChange={setViewMode} />
      </div>

      {onPairs && (
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
      )}

      {hasClusters && activeTab === "clusters" && (
        <div className={listClass}>
          {clusters.map((cluster, i) => (
            <div key={cluster.id} className="relative h-full">
              {ui.bookmarkedIds.has(cluster.id) && (
                <span className="absolute right-2 top-2 z-10 text-amber-500" aria-hidden>
                  ★
                </span>
              )}
              {ui.masteredIds.has(cluster.id) && (
                <span className="absolute left-2 top-2 z-10 text-emerald-500" aria-hidden>
                  ✅
                </span>
              )}
              <SynClusterCard cluster={cluster} layout={viewMode} onOpen={() => ui.open(i)} />
            </div>
          ))}
        </div>
      )}

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
        {openCluster && (
          <SynClusterDetailPanel
            key={openCluster.id}
            cluster={openCluster}
            language={language}
            zoom={ui.zoom}
            highlightIndex={highlight}
          />
        )}
      </ClusterBrowserShell>
    </div>
  );
}
