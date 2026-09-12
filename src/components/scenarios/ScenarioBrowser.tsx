"use client";

import { useEffect, useState, type MouseEvent } from "react";
import type { Language } from "@/types/vocab";
import type { ScenarioChain, ScenarioCluster, ScenarioEntry, ScenarioLanguageData, ScenarioNode, ScenarioPos } from "@/types/scenario";
import { speak, ttsFailureMessage } from "@/lib/tts";
import { loadScenarioProgress, toggleScenarioLearned } from "@/lib/scenarioProgress";
import { useFullscreen } from "@/lib/useFullscreen";

type LearnedFilter = "all" | "learned" | "unlearned";

function LearnedToggle({
  learned,
  onToggle,
  large,
}: {
  learned: boolean;
  onToggle: (e: MouseEvent) => void;
  large?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={learned}
      aria-label={learned ? "Bỏ đánh dấu đã thuộc" : "Đánh dấu đã thuộc"}
      title={learned ? "Đã thuộc — bấm để bỏ đánh dấu" : "Đánh dấu đã thuộc"}
      className={`flex flex-none items-center justify-center rounded-full border text-sm transition ${
        large ? "h-9 w-9" : "h-8 w-8"
      } ${
        learned
          ? "border-emerald-400 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300"
          : "border-border bg-surface-2 text-ink-muted hover:border-rose-300"
      }`}
    >
      {learned ? "✓" : "○"}
    </button>
  );
}

const POS_LABEL: Record<ScenarioPos, string> = {
  noun: "danh từ",
  "verb-phrase": "cụm động từ",
  adjective: "tính từ",
  adverb: "trạng từ",
  emotion: "cảm xúc",
  idiom: "thành ngữ",
  phrase: "cụm từ",
};

const POS_STYLE: Record<ScenarioPos, string> = {
  noun: "border-sky-400 bg-sky-50 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  "verb-phrase": "border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  adjective: "border-violet-400 bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  adverb: "border-teal-400 bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  emotion: "border-pink-400 bg-pink-50 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
  idiom: "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  phrase: "border-slate-400 bg-slate-50 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
};

function StepCard({ node, language, index, stepId }: { node: ScenarioNode; language: Language; index: number; stepId?: string }) {
  const [error, setError] = useState<string | null>(null);
  // Mặc định ẨN nghĩa tiếng Việt — chỉ hiện tiếng gốc + cách đọc, để luyện phản xạ đọc-hiểu thay vì
  // nhìn thấy nghĩa ngay. Bấm vào dòng "chạm để xem nghĩa" (KHÔNG phải cả thẻ) để hiện/ẩn nghĩa CỦA
  // RIÊNG thẻ đó — cả thẻ giờ dùng để PHÁT ÂM khi chạm, tách biệt 2 hành động theo yêu cầu người dùng.
  const [revealed, setRevealed] = useState(false);

  async function speakNode() {
    setError(null);
    const result = await speak(node.headword, language);
    if (!result.ok) setError(ttsFailureMessage(result.reason));
  }

  return (
    <div
      id={stepId}
      role="button"
      tabIndex={0}
      onClick={speakNode}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          speakNode();
        }
      }}
      aria-label={`Phát âm ${node.headword}`}
      className="flex w-64 shrink-0 cursor-pointer flex-col gap-1.5 rounded-xl border border-border bg-surface p-4 text-left shadow-sm transition hover:border-rose-300 sm:w-72"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-surface-3 text-[10px] font-bold text-ink-muted">
          {index + 1}
        </span>
        <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${POS_STYLE[node.pos]}`}>
          {POS_LABEL[node.pos]}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            speakNode();
          }}
          className="ml-auto flex h-6 w-6 flex-none items-center justify-center rounded-full border border-border bg-surface-3 text-[11px] hover:bg-brand-50"
          aria-label="Phát âm"
        >
          🔊
        </button>
      </div>
      <p className="text-base font-medium leading-snug text-ink">{node.headword}</p>
      <p className="text-xs italic text-brand-600">{node.reading}</p>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setRevealed((r) => !r);
        }}
        className="flex w-fit flex-col items-start gap-1 text-left"
        aria-label={revealed ? "Ẩn nghĩa" : "Xem nghĩa"}
      >
        {revealed ? (
          <>
            {node.hanViet && (
              <span className="inline-block w-fit rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-bold text-ink-muted">
                Hán Việt: {node.hanViet}
              </span>
            )}
            <span className="text-xs text-ink-muted">{node.meaningVn}</span>
          </>
        ) : (
          <span className="text-[11px] text-ink-muted/70 underline decoration-dotted">👁 chạm để xem nghĩa</span>
        )}
      </button>
      {error && <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

function previewText(chain: ScenarioChain): string {
  return chain.titleVn.length > 90 ? `${chain.titleVn.slice(0, 90)}…` : chain.titleVn;
}

function ScenarioChainCard({
  chain,
  language,
  learned,
  onToggleLearned,
}: {
  chain: ScenarioChain;
  language: Language;
  learned: boolean;
  onToggleLearned: () => void;
}) {
  const {
    containerRef,
    isFullscreen,
    enterFullscreen: openFullscreen,
    exitFullscreen: closeFullscreen,
    fullscreenClassName,
  } = useFullscreen<HTMLDivElement>();
  const [showTranslation, setShowTranslation] = useState(false);

  if (!isFullscreen) {
    return (
      <div ref={containerRef} className="flex items-center gap-2">
        <LearnedToggle
          learned={learned}
          onToggle={(e) => {
            e.stopPropagation();
            onToggleLearned();
          }}
        />
        <button
          type="button"
          onClick={openFullscreen}
          className={`flex min-w-0 flex-1 items-center gap-3 rounded-2xl border px-4 py-3 text-left shadow-sm transition hover:border-rose-300 hover:shadow-md ${
            learned ? "border-emerald-200 bg-emerald-50/40 dark:bg-emerald-900/10" : "border-border bg-surface-2"
          }`}
        >
          <span className="flex-1 truncate text-sm font-medium text-ink">{previewText(chain)}</span>
          <span className="flex-none rounded-md bg-surface-3 px-2 py-0.5 text-[10px] font-bold text-ink-muted">
            {chain.nodes.length} bước
          </span>
          <span className="flex-none text-rose-500">⛶</span>
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`flex h-full flex-col overflow-hidden bg-surface ${fullscreenClassName}`}>
      <div className="flex items-center justify-between gap-2 border-b border-border px-6 py-3 sm:px-10">
        <span className="font-mono text-xs text-ink-muted">{chain.id}</span>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-surface-3 px-2 py-0.5 text-[11px] font-bold text-ink-muted">
            {chain.nodes.length} bước
          </span>
          <LearnedToggle learned={learned} onToggle={() => onToggleLearned()} />
          <button
            type="button"
            onClick={closeFullscreen}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-2 text-sm text-ink hover:border-rose-300 hover:bg-surface-3"
            aria-label="Thoát toàn màn hình"
          >
            ⤢
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-auto p-6 sm:p-10">
        <h2 className="text-center text-base font-semibold text-ink">{chain.titleVn}</h2>

        {/* Chảy trái→phải, hết dòng thì tự xuống dòng tiếp (flex-wrap) — thấy được TOÀN BỘ chuỗi trên
            màn hình cùng lúc thay vì phải cuộn/kéo qua 1 hàng hoặc 1 cột dài duy nhất như trước, đúng
            góp ý "vẽ nối từ trái qua phải từ trên xuống dưới, show hết kịch bản trên UI hiện tại". */}
        <div className="mx-auto mt-5 flex max-w-3xl flex-row flex-wrap items-start justify-center gap-x-3 gap-y-4">
          {chain.nodes.map((node, i) => (
            // Dưới breakpoint md, 1 thẻ chiếm trọn hàng nên bước tiếp theo luôn rơi XUỐNG DƯỚI — xếp
            // dọc + mũi tên ↓; từ md trở lên thường xếp được ≥2 thẻ/hàng — xếp ngang + mũi tên →.
            <div key={i} className="flex flex-col items-center gap-2 md:flex-row">
              <StepCard node={node} language={language} index={i} stepId={`${chain.id}-step-${i}`} />
              {i < chain.nodes.length - 1 && (
                <span className="shrink-0 text-lg text-rose-400" aria-hidden>
                  <span className="md:hidden">↓</span>
                  <span className="hidden md:inline">→</span>
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="mx-auto mt-6 flex w-full max-w-2xl flex-col gap-2 rounded-xl border border-border bg-surface-2 p-4">
          <p className="hanzi text-sm text-ink">{chain.example}</p>
          {showTranslation ? (
            <p className="text-sm text-ink-muted">{chain.exampleVn}</p>
          ) : (
            <button
              type="button"
              onClick={() => setShowTranslation(true)}
              className="w-fit text-xs font-medium text-brand-600 underline decoration-dotted hover:text-brand-700"
            >
              👁 Xem nghĩa câu
            </button>
          )}
        </div>

        <p className="mx-auto mt-4 max-w-2xl text-center text-xs text-ink-muted">{chain.note}</p>
      </div>
    </div>
  );
}

function ClusterWordCard({ word, language }: { word: ScenarioNode; language: Language }) {
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  async function speakWord() {
    setError(null);
    const result = await speak(word.headword, language);
    if (!result.ok) setError(ttsFailureMessage(result.reason));
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={speakWord}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          speakWord();
        }
      }}
      aria-label={`Phát âm ${word.headword}`}
      className="cursor-pointer rounded-xl border border-border-strong bg-surface-2 px-3.5 py-2.5 text-left shadow-sm transition hover:border-rose-300"
    >
      <div className="flex items-center gap-2">
        <span className={`inline-block rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${POS_STYLE[word.pos]}`}>
          {POS_LABEL[word.pos]}
        </span>
        <span className="text-base font-medium text-ink">{word.headword}</span>
        <span className="text-xs italic text-brand-600">{word.reading}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            speakWord();
          }}
          className="ml-auto flex h-6 w-6 flex-none items-center justify-center rounded-full border border-border bg-surface-3 text-[11px] hover:bg-brand-50"
          aria-label="Phát âm"
        >
          🔊
        </button>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setRevealed((r) => !r);
        }}
        className="mt-1 block w-fit text-left"
        aria-label={revealed ? "Ẩn nghĩa" : "Xem nghĩa"}
      >
        {revealed ? (
          <span className="text-xs text-ink-muted">
            {word.hanViet && <span className="font-semibold text-ink">{word.hanViet} — </span>}
            {word.meaningVn}
          </span>
        ) : (
          <span className="text-[11px] text-ink-muted/70 underline decoration-dotted">👁 chạm để xem nghĩa</span>
        )}
      </button>
      {error && <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

function ScenarioClusterCard({
  cluster,
  language,
  learned,
  onToggleLearned,
}: {
  cluster: ScenarioCluster;
  language: Language;
  learned: boolean;
  onToggleLearned: () => void;
}) {
  const {
    containerRef,
    isFullscreen,
    enterFullscreen: openFullscreen,
    exitFullscreen: closeFullscreen,
    fullscreenClassName,
  } = useFullscreen<HTMLDivElement>();

  const preview = cluster.words.map((w) => w.headword).join(" · ");

  if (!isFullscreen) {
    return (
      <div ref={containerRef} className="flex items-center gap-2">
        <LearnedToggle
          learned={learned}
          onToggle={(e) => {
            e.stopPropagation();
            onToggleLearned();
          }}
        />
        <button
          type="button"
          onClick={openFullscreen}
          className={`flex min-w-0 flex-1 items-center gap-3 rounded-2xl border px-4 py-3 text-left shadow-sm transition hover:border-rose-300 hover:shadow-md ${
            learned ? "border-emerald-200 bg-emerald-50/40 dark:bg-emerald-900/10" : "border-border bg-surface-2"
          }`}
        >
          <span className="flex-none rounded-full bg-brand-600 px-2.5 py-1 text-xs font-bold text-white">
            {cluster.themeVn}
          </span>
          <span className="flex-1 truncate text-sm text-ink">{preview}</span>
          <span className="flex-none rounded-md bg-surface-3 px-2 py-0.5 text-[10px] font-bold text-ink-muted">
            chùm
          </span>
          <span className="flex-none text-rose-500">⛶</span>
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`flex h-full flex-col justify-center overflow-auto bg-surface p-6 sm:p-10 ${fullscreenClassName}`}
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col">
        <div className="mb-5 flex items-center justify-between gap-2">
          <span className="font-mono text-xs text-ink-muted">{cluster.id}</span>
          <div className="flex items-center gap-2">
            <LearnedToggle learned={learned} onToggle={() => onToggleLearned()} />
            <button
              type="button"
              onClick={closeFullscreen}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-2 text-sm text-ink hover:border-rose-300 hover:bg-surface-3"
              aria-label="Thoát toàn màn hình"
            >
              ⤢
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="rounded-2xl bg-brand-600 px-6 py-3 text-center text-white shadow">
            <div className="text-lg font-semibold">{cluster.themeVn}</div>
          </div>
          <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
            {cluster.words.map((w, i) => (
              <ClusterWordCard key={i} word={w} language={language} />
            ))}
          </div>
          <p className="text-center text-sm text-ink-muted">{cluster.note}</p>
        </div>
      </div>
    </div>
  );
}

function isCluster(entry: ScenarioEntry): entry is ScenarioCluster {
  return entry.kind === "scenario-cluster";
}

const FILTER_LABEL: Record<LearnedFilter, string> = {
  all: "Tất cả",
  learned: "Đã thuộc",
  unlearned: "Chưa thuộc",
};

export default function ScenarioBrowser({ language, data }: { language: Language; data: ScenarioLanguageData }) {
  const chains = data.scenarios.filter((s): s is ScenarioChain => s.kind === "scenario-chain");
  const clusters = data.scenarios.filter(isCluster);

  const [learnedIds, setLearnedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<LearnedFilter>("all");

  useEffect(() => {
    let cancelled = false;
    loadScenarioProgress().then((progress) => {
      if (cancelled) return;
      const ids = Object.entries(progress)
        .filter(([, p]) => p.mastered)
        .map(([id]) => id);
      setLearnedIds(new Set(ids));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleToggleLearned(id: string) {
    setLearnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    try {
      await toggleScenarioLearned(id);
    } catch {
      // rollback nếu lưu thất bại
      setLearnedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
  }

  function matchesFilter(id: string): boolean {
    if (filter === "all") return true;
    const isLearned = learnedIds.has(id);
    return filter === "learned" ? isLearned : !isLearned;
  }

  const visibleChains = chains.filter((c) => matchesFilter(c.id));
  const visibleClusters = clusters.filter((c) => matchesFilter(c.id));
  const learnedCount = chains.filter((c) => learnedIds.has(c.id)).length + clusters.filter((c) => learnedIds.has(c.id)).length;
  const totalCount = chains.length + clusters.length;

  return (
    <div className="flex flex-col gap-2">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-border bg-surface-2 p-0.5">
          {(Object.keys(FILTER_LABEL) as LearnedFilter[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                filter === key ? "bg-rose-500 text-white shadow-sm" : "text-ink-muted hover:text-ink"
              }`}
            >
              {FILTER_LABEL[key]}
            </button>
          ))}
        </div>
        <span className="text-xs text-ink-muted">
          {learnedCount}/{totalCount} đã thuộc
        </span>
      </div>

      {visibleChains.length === 0 && visibleClusters.length === 0 && (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-ink-muted">
          Không có chuỗi nào khớp bộ lọc &ldquo;{FILTER_LABEL[filter]}&rdquo;.
        </p>
      )}

      {visibleChains.map((chain) => (
        <ScenarioChainCard
          key={chain.id}
          chain={chain}
          language={language}
          learned={learnedIds.has(chain.id)}
          onToggleLearned={() => handleToggleLearned(chain.id)}
        />
      ))}
      {visibleClusters.length > 0 && (
        <>
          <div className="mt-2 flex items-center gap-2 px-1">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">Chùm từ theo chủ đề</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          {visibleClusters.map((cluster) => (
            <ScenarioClusterCard
              key={cluster.id}
              cluster={cluster}
              language={language}
              learned={learnedIds.has(cluster.id)}
              onToggleLearned={() => handleToggleLearned(cluster.id)}
            />
          ))}
        </>
      )}
    </div>
  );
}
