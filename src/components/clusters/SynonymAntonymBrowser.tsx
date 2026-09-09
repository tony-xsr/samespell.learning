"use client";

import { useEffect, useState } from "react";
import type { Language } from "@/types/vocab";
import type {
  ClusterWord,
  SynonymAntonymLanguageData,
  SynonymAntonymPair,
  SynonymCluster,
} from "@/types/wordCluster";
import { useFullscreen } from "@/lib/useFullscreen";
import { speak, ttsFailureMessage } from "@/lib/tts";
import ViewModeToggle, { type ViewMode } from "@/components/ui/ViewModeToggle";
import BrowserTabs from "@/components/ui/BrowserTabs";

function WordCard({
  word,
  language,
  tone,
}: {
  word: ClusterWord;
  language: Language;
  tone: "syn" | "ant";
}) {
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

function PairCard({ pair, language, layout }: { pair: SynonymAntonymPair; language: Language; layout: ViewMode }) {
  const {
    containerRef,
    isFullscreen,
    enterFullscreen: openFullscreen,
    exitFullscreen: closeFullscreen,
    fullscreenClassName,
  } = useFullscreen<HTMLDivElement>();
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!isFullscreen) setZoom(1);
  }, [isFullscreen]);

  const synPreview = pair.synonymCluster.words.map((w) => w.headword).join("·");
  const antPreview = pair.antonymCluster.words.map((w) => w.headword).join("·");

  if (!isFullscreen) {
    if (layout === "grid") {
      return (
        <div ref={containerRef} className="h-full">
          <button
            type="button"
            onClick={openFullscreen}
            className="flex h-full w-full flex-col items-start gap-2 rounded-2xl border border-border bg-surface-2 p-3 text-left shadow-sm transition hover:border-amber-300 hover:shadow-md"
          >
            <span className="hanzi line-clamp-2 text-sm font-medium text-ink">
              <span className="text-brand-600">{synPreview}</span>
              <span className="mx-2 text-ink-muted">⇕</span>
              <span className="text-accent-600">{antPreview}</span>
            </span>
            <span className="mt-auto text-amber-500">⛶</span>
          </button>
        </div>
      );
    }
    return (
      <div ref={containerRef}>
        <button
          type="button"
          onClick={openFullscreen}
          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3 text-left shadow-sm transition hover:border-amber-300 hover:shadow-md"
        >
          <span className="hanzi flex-1 truncate text-sm font-medium text-ink">
            <span className="text-brand-600">{synPreview}</span>
            <span className="mx-2 text-ink-muted">⇕</span>
            <span className="text-accent-600">{antPreview}</span>
          </span>
          <span className="flex-none text-amber-500">⛶</span>
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`flex h-full flex-col justify-center overflow-auto bg-surface p-6 sm:p-10 ${fullscreenClassName}`}
    >
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
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-bold uppercase tracking-wide text-brand-600">
                Cụm gần nghĩa{pair.synonymCluster.sharedChar ? ` — chung chữ ${pair.synonymCluster.sharedChar}` : ""}
              </span>
              {pair.synonymCluster.words.map((w, i) => (
                <WordCard key={i} word={w} language={language} tone="syn" />
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
                <WordCard key={i} word={w} language={language} tone="ant" />
              ))}
            </div>
          </div>

          <p className="mt-5 text-center text-sm text-ink-muted">{pair.note}</p>
        </div>
      </div>
    </div>
  );
}

function SynClusterCard({ cluster, language, layout }: { cluster: SynonymCluster; language: Language; layout: ViewMode }) {
  const {
    containerRef,
    isFullscreen,
    enterFullscreen: openFullscreen,
    exitFullscreen: closeFullscreen,
    fullscreenClassName,
  } = useFullscreen<HTMLDivElement>();
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!isFullscreen) setZoom(1);
  }, [isFullscreen]);

  const preview = cluster.words.map((w) => w.headword).join(" · ");

  if (!isFullscreen) {
    if (layout === "grid") {
      return (
        <div ref={containerRef} className="h-full">
          <button
            type="button"
            onClick={openFullscreen}
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
        </div>
      );
    }
    return (
      <div ref={containerRef}>
        <button
          type="button"
          onClick={openFullscreen}
          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3 text-left shadow-sm transition hover:border-amber-300 hover:shadow-md"
        >
          <span className="hanzi flex-1 truncate text-sm font-medium text-brand-600">{preview}</span>
          <span className="flex-none rounded-md bg-surface-3 px-2 py-0.5 text-[10px] font-bold text-ink-muted">
            cụm gần nghĩa
          </span>
          <span className="flex-none text-amber-500">⛶</span>
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`flex h-full flex-col justify-center overflow-auto bg-surface p-6 sm:p-10 ${fullscreenClassName}`}
    >
      <div className="mx-auto flex w-full max-w-xl flex-col">
        <div className="mb-5 flex items-center justify-between gap-2">
          <span className="font-mono text-xs text-ink-muted">{cluster.id}</span>
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

        <div style={{ zoom }} className="flex flex-col gap-2.5">
          <span className="text-xs font-bold uppercase tracking-wide text-brand-600">
            Cụm gần nghĩa{cluster.sharedChar ? ` — chung chữ ${cluster.sharedChar}` : ""}
          </span>
          {cluster.words.map((w, i) => (
            <WordCard key={i} word={w} language={language} tone="syn" />
          ))}
          <p className="mt-2 text-center text-sm text-ink-muted">{cluster.note}</p>
        </div>
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

  const listClass = viewMode === "grid" ? "grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-2";

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

      {(!hasClusters || activeTab === "pairs") && (
        <div className={listClass}>
          {data.pairs.map((pair) => (
            <PairCard key={pair.id} pair={pair} language={language} layout={viewMode} />
          ))}
        </div>
      )}

      {hasClusters && activeTab === "clusters" && (
        <div className={listClass}>
          {data.synonymClusters!.map((cluster) => (
            <SynClusterCard key={cluster.id} cluster={cluster} language={language} layout={viewMode} />
          ))}
        </div>
      )}
    </div>
  );
}
