"use client";

import { useEffect, useRef, useState } from "react";
import type { Language } from "@/types/vocab";
import type { ChainLanguageData, ChainNode, ClusterMemberWord, WordChain, WordCluster } from "@/types/chain";
import { speak, ttsFailureMessage } from "@/lib/tts";

function isTieChar(node: ChainNode, chars: string[], index: number): boolean {
  if (index === 0 && node.sharedCharPrev && chars[0] === node.sharedCharPrev) return true;
  if (index === chars.length - 1 && node.sharedCharNext && chars[chars.length - 1] === node.sharedCharNext)
    return true;
  return false;
}

/** Rút gọn chuỗi thành 3 từ đại diện (đầu, giữa, cuối) để hiện trên dòng tóm tắt — tránh liệt kê hết
 * khi chuỗi dài, gây rối mắt trên danh sách chính. */
function previewWords(chain: WordChain): string {
  const words = chain.nodes.map((n) => n.headword);
  if (words.length <= 3) return words.join(" → ");
  return `${words[0]} → ⋯ → ${words[words.length - 1]}`;
}

function NodeTile({
  node,
  active,
  large,
  onToggle,
}: {
  node: ChainNode;
  active: boolean;
  large: boolean;
  onToggle: () => void;
}) {
  const chars = Array.from(node.headword);
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex overflow-hidden rounded-xl border-2 bg-surface-2 shadow-sm transition hover:border-amber-400 hover:-translate-y-0.5 ${
        active ? "border-amber-500 ring-2 ring-amber-200" : "border-border-strong"
      }`}
    >
      {chars.map((ch, i) => (
        <span
          key={i}
          className={`font-medium leading-none ${large ? "px-4 py-3 text-3xl" : "px-3 py-2 text-xl"} ${
            i > 0 ? "border-l border-dashed border-border" : ""
          } ${isTieChar(node, chars, i) ? "text-accent-600" : "text-ink"}`}
        >
          {ch}
        </span>
      ))}
    </button>
  );
}

function JointPin({ char, large }: { char: string; large: boolean }) {
  return (
    <div className={`flex flex-none items-center ${large ? "w-14" : "w-11"}`} aria-hidden>
      <span className="h-0.5 flex-1 bg-border-strong" />
      <span
        className={`flex flex-none items-center justify-center rounded-full border-2 border-surface-2 bg-accent-500 font-bold text-white shadow ${
          large ? "h-8 w-8 text-sm" : "h-6 w-6 text-xs"
        }`}
      >
        {char}
      </span>
      <span className="h-0.5 flex-1 bg-border-strong" />
    </div>
  );
}

function positionLabel(node: ChainNode): string {
  const prev = node.sharedCharPrev ? `nối trước qua ${node.sharedCharPrev}` : "đầu chuỗi";
  const next = node.sharedCharNext ? `nối sau qua ${node.sharedCharNext}` : "cuối chuỗi";
  return `${prev} · ${next}`;
}

function ChainCard({ chain, language }: { chain: WordChain; language: Language }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);
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
    containerRef.current?.requestFullscreen().catch(() => {
      // trình duyệt/thiết bị không hỗ trợ Fullscreen API — bỏ qua, không có gì để rollback
    });
  }

  function closeFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
  }

  async function handleSpeak(node: ChainNode) {
    setTtsError(null);
    const result = await speak(node.headword, language);
    if (!result.ok) setTtsError(ttsFailureMessage(result.reason));
  }

  const openNode = openIndex !== null ? chain.nodes[openIndex] : undefined;

  if (!isFullscreen) {
    return (
      <div ref={containerRef}>
        <button
          type="button"
          onClick={openFullscreen}
          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3 text-left shadow-sm transition hover:border-amber-300 hover:shadow-md"
        >
          <span className="hanzi flex-1 truncate text-base font-medium text-ink">{previewWords(chain)}</span>
          <span className="flex-none rounded-md bg-surface-3 px-2 py-0.5 text-[10px] font-bold text-ink-muted">
            {chain.nodes.length} mắt xích
          </span>
          <span className="flex-none text-amber-500">⛶</span>
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex h-full flex-col overflow-hidden bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-border px-6 py-3 sm:px-10">
        <span className="font-mono text-xs text-ink-muted">{chain.id}</span>
        <div className="flex items-center gap-1">
          <span className="mr-1 rounded-md bg-surface-3 px-2 py-0.5 text-[11px] font-bold text-ink-muted">
            {chain.nodes.length} mắt xích
          </span>
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

      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="flex flex-1 flex-col items-center justify-center overflow-auto p-6 sm:p-10">
          <div style={{ zoom }}>
            <div className="flex flex-wrap items-start justify-center gap-y-6">
              {chain.nodes.map((node, i) => (
                <div key={i} className="flex items-start">
                  <div className="flex flex-col items-center gap-1.5">
                    <NodeTile
                      node={node}
                      large
                      active={openIndex === i}
                      onToggle={() => setOpenIndex(openIndex === i ? null : i)}
                    />
                    <span className="whitespace-nowrap text-sm text-ink-muted">
                      {node.reading} — {node.meaningVn}
                    </span>
                  </div>
                  {i < chain.nodes.length - 1 && node.sharedCharNext && (
                    <div className="pt-4">
                      <JointPin char={node.sharedCharNext} large />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <p className="mt-4 text-center text-sm text-ink-muted">{chain.note}</p>
          </div>
        </div>

        {openNode && (
          <div className="w-full flex-none overflow-auto border-t border-border p-5 lg:h-full lg:w-96 lg:border-t-0 lg:border-l">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-medium text-ink">{openNode.headword}</span>
              {openNode.hanja && <span className="text-sm text-ink-muted">({openNode.hanja})</span>}
              <button
                type="button"
                onClick={() => handleSpeak(openNode)}
                className="ml-auto flex h-8 w-8 flex-none items-center justify-center rounded-full border border-border-strong bg-surface-2 text-sm hover:bg-brand-50"
                aria-label="Phát âm"
              >
                🔊
              </button>
              <button
                type="button"
                onClick={() => setOpenIndex(null)}
                className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-border bg-surface-2 text-sm text-ink-muted hover:bg-surface-3"
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>
            <p className="mt-1 text-sm italic text-brand-600">{openNode.reading}</p>
            <span className="mt-1 inline-block rounded bg-surface-3 px-2 py-0.5 text-[11px] font-bold text-ink-muted">
              Hán Việt: {openNode.hanViet}
            </span>
            <dl className="mt-3 flex flex-col gap-2 text-[13px]">
              <div className="flex gap-2">
                <dt className="w-16 flex-none font-semibold text-ink-muted">Nghĩa</dt>
                <dd className="text-ink">{openNode.meaningVn}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-16 flex-none font-semibold text-ink-muted">Vị trí</dt>
                <dd className="text-ink">{positionLabel(openNode)}</dd>
              </div>
            </dl>
            {ttsError && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{ttsError}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function ClusterWordCard({ word, language }: { word: ClusterMemberWord; language: Language }) {
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
        <span className="text-xs italic text-brand-600">{word.reading}</span>
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

function ClusterCard({ cluster, language }: { cluster: WordCluster; language: Language }) {
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

  const preview = cluster.words.map((w) => w.headword).join(" · ");

  if (!isFullscreen) {
    return (
      <div ref={containerRef}>
        <button
          type="button"
          onClick={openFullscreen}
          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3 text-left shadow-sm transition hover:border-amber-300 hover:shadow-md"
        >
          <span className="flex-none rounded-full bg-brand-600 px-2.5 py-1 text-sm font-bold text-white">
            {cluster.centerChar}
          </span>
          <span className="hanzi flex-1 truncate text-base font-medium text-ink">{preview}</span>
          <span className="flex-none rounded-md bg-surface-3 px-2 py-0.5 text-[10px] font-bold text-ink-muted">
            chùm
          </span>
          <span className="flex-none text-amber-500">⛶</span>
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex h-full flex-col justify-center overflow-auto bg-surface p-6 sm:p-10">
      <div className="mx-auto flex w-full max-w-2xl flex-col">
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

        <div style={{ zoom }} className="flex flex-col items-center gap-4">
          <div className="rounded-2xl bg-brand-600 px-6 py-3 text-center text-white shadow">
            <div className="hanzi text-3xl">{cluster.centerChar}</div>
            <div className="mt-0.5 text-xs opacity-90">
              {cluster.centerReading} · {cluster.centerHanViet}
            </div>
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

export default function ChainBrowser({ language, data }: { language: Language; data: ChainLanguageData }) {
  return (
    <div className="flex flex-col gap-2">
      {data.chains.map((chain) => (
        <ChainCard key={chain.id} chain={chain} language={language} />
      ))}
      {data.clusters && data.clusters.length > 0 && (
        <>
          <div className="mt-2 flex items-center gap-2 px-1">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">Chùm từ quanh 1 chữ</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          {data.clusters.map((cluster) => (
            <ClusterCard key={cluster.id} cluster={cluster} language={language} />
          ))}
        </>
      )}
    </div>
  );
}
