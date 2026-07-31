"use client";

import { useEffect, useRef, useState } from "react";
import type { Language } from "@/types/vocab";
import type { ResolvedGrammarBranchingStory } from "@/lib/grammarStories";
import { curvePath } from "@/lib/mindmapLayout";
import { branchColor } from "@/lib/mindmapColors";
import { speak, ttsFailureMessage } from "@/lib/tts";
import { useGrammarExtras } from "@/lib/useGrammarExtras";
import GrammarPointDetailModal from "@/components/grammar/GrammarPointDetailModal";
import StoryNodeSentence from "@/components/grammar/StoryNodeSentence";

/** Canvas "cây quyết định" — mở đầu (trunk) là 1 chuỗi thẳng như GrammarStoryCanvas, nhưng tới cuối
 * thì TOẢ NHÁNH (fork) thành ≥2 lựa chọn phản hồi khác nhau, xếp dọc quanh trục Y trung tâm — mượn
 * lại đúng cơ chế toả nhánh cong (curvePath) của mindmap nhưng chỉ toả ở ĐIỂM CUỐI, không phải từ tâm. */
const NODE_W = 220;
const STEP_X = 300;
const START_X = 150;
const ROW_Y = 220;
const BRANCH_GAP_Y = 150;
const MARGIN = 80;

export default function GrammarBranchingStoryCanvas({
  story,
  lang,
}: {
  story: ResolvedGrammarBranchingStory;
  lang: Language;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [activePointId, setActivePointId] = useState<string | null>(null);
  const [ttsWarning, setTtsWarning] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const { extras, addingExampleId, addingMnemonicId, aiError, addExample, addMnemonic } = useGrammarExtras(lang);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current?.requestFullscreen().catch(() => {});
    }
  }

  function toggleReveal(id: string) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSpeak(text: string) {
    speak(text, lang).then((r) => {
      setTtsWarning(r.ok ? null : ttsFailureMessage(r.reason));
    });
  }

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("[data-story-node]")) return;
    const el = viewportRef.current;
    if (!el) return;
    e.preventDefault();
    dragRef.current = { x: e.clientX, y: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop };
    setIsDragging(true);
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const el = viewportRef.current;
    if (!drag || !el) return;
    el.scrollLeft = drag.scrollLeft - (e.clientX - drag.x);
    el.scrollTop = drag.scrollTop - (e.clientY - drag.y);
  }

  function stopDrag() {
    dragRef.current = null;
    setIsDragging(false);
  }

  const trunkCount = story.trunk.length;
  const branchCount = story.branches.length;
  const branchX = START_X + STEP_X * trunkCount;
  const width = branchX + STEP_X + NODE_W / 2 + MARGIN;
  const branchTopY = ROW_Y - ((branchCount - 1) * BRANCH_GAP_Y) / 2;
  const height = Math.max(ROW_Y * 2, branchTopY + (branchCount - 1) * BRANCH_GAP_Y + 140);

  interface AllPoint {
    id: string;
    labelVn: string;
    point: (typeof story.trunk)[number]["point"];
    example: (typeof story.trunk)[number]["example"];
  }
  const activeAll: AllPoint[] = [
    ...story.trunk.map((s) => ({ id: s.point.id, labelVn: s.timeLabelVn, point: s.point, example: s.example })),
    ...story.branches.map((b) => ({ id: b.point.id, labelVn: b.labelVn, point: b.point, example: b.example })),
  ];
  const activeItem = activeAll.find((a) => a.id === activePointId);
  const activeColorIndex = activeItem ? activeAll.indexOf(activeItem) : 0;
  const activeColor = activeItem ? branchColor(activeColorIndex) : null;

  return (
    <div ref={containerRef} className={`relative ${isFullscreen ? "flex h-full flex-col bg-surface p-3" : ""}`}>
      <div className="mb-2 flex items-center justify-end gap-1">
        <button
          onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-2 text-sm text-ink hover:border-brand-300 hover:bg-surface-3"
          aria-label="Thu nhỏ"
        >
          −
        </button>
        <span className="w-12 text-center text-xs text-ink-muted">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(2)))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-2 text-sm text-ink hover:border-brand-300 hover:bg-surface-3"
          aria-label="Phóng to"
        >
          +
        </button>
        <button
          onClick={toggleFullscreen}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-2 text-sm text-ink hover:border-brand-300 hover:bg-surface-3"
          aria-label={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
        >
          {isFullscreen ? "⤢" : "⛶"}
        </button>
      </div>

      <div
        ref={viewportRef}
        className={`${isFullscreen ? "flex-1" : "h-[65vh]"} w-full overflow-auto rounded-2xl border border-border bg-surface-3/40`}
      >
        <div style={{ width: width * zoom, height: height * zoom }}>
          <div
            style={{ width, height, transform: `scale(${zoom})`, transformOrigin: "0 0" }}
            className={`relative select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={stopDrag}
            onMouseLeave={stopDrag}
          >
            <svg width={width} height={height} className="pointer-events-none absolute inset-0">
              {story.trunk.slice(1).map((_, i) => {
                const x1 = START_X + STEP_X * i + NODE_W / 2;
                const x2 = START_X + STEP_X * (i + 1) - NODE_W / 2;
                const color = branchColor(i + 1);
                return (
                  <path key={`trunk-line-${i}`} d={curvePath(x1, ROW_Y, x2, ROW_Y, 1)} stroke={color.stroke} strokeWidth={2.5} fill="none" opacity={0.7} />
                );
              })}
              {story.branches.map((_, i) => {
                const lastTrunkX = START_X + STEP_X * (trunkCount - 1) + NODE_W / 2;
                const bx = branchX - NODE_W / 2;
                const by = branchTopY + i * BRANCH_GAP_Y;
                const color = branchColor(trunkCount + i);
                return (
                  <path key={`branch-line-${i}`} d={curvePath(lastTrunkX, ROW_Y, bx, by, 1)} stroke={color.stroke} strokeWidth={2.5} fill="none" opacity={0.7} />
                );
              })}
            </svg>

            {story.trunk.map((step, i) => {
              const color = branchColor(i);
              const x = START_X + STEP_X * i;
              const isRevealed = revealed.has(step.point.id);
              return (
                <div
                  key={step.point.id}
                  data-story-node
                  style={{ left: x, top: ROW_Y, width: NODE_W }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 ${color.border} ${color.bg} px-3 py-2 text-center shadow-sm`}
                >
                  <span className="inline-block rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-ink-muted">
                    {step.timeLabelVn}
                  </span>
                  <StoryNodeSentence sentence={step.example.sentence} lang={lang} />
                  {isRevealed ? (
                    <div className={`mt-0.5 text-xs ${color.text}`}>{step.example.translationVn}</div>
                  ) : (
                    <button onClick={() => toggleReveal(step.point.id)} className="mt-0.5 text-xs font-medium text-ink-muted underline decoration-dotted hover:text-ink">
                      👁 Xem nghĩa
                    </button>
                  )}
                  <button
                    onClick={() => handleSpeak(step.example.sentence)}
                    aria-label="Đọc to"
                    className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface-2 text-[11px] shadow hover:bg-surface-3"
                  >
                    🔊
                  </button>
                  <button
                    onClick={() => setActivePointId((id) => (id === step.point.id ? null : step.point.id))}
                    aria-label="Xem chi tiết"
                    className="absolute -bottom-2 -left-2 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface-2 text-[11px] font-bold text-ink-muted shadow hover:bg-surface-3"
                  >
                    i
                  </button>
                </div>
              );
            })}

            {story.branches.map((branch, i) => {
              const color = branchColor(trunkCount + i);
              const y = branchTopY + i * BRANCH_GAP_Y;
              const isRevealed = revealed.has(branch.point.id);
              return (
                <div
                  key={branch.point.id}
                  data-story-node
                  style={{ left: branchX, top: y, width: NODE_W }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 ${color.border} ${color.bg} px-3 py-2 text-center shadow-sm`}
                >
                  <span className="inline-block rounded-full bg-surface px-2 py-0.5 text-[10px] font-bold text-ink">
                    {branch.labelVn}
                  </span>
                  <StoryNodeSentence sentence={branch.example.sentence} lang={lang} />
                  {isRevealed ? (
                    <div className={`mt-0.5 text-xs ${color.text}`}>{branch.example.translationVn}</div>
                  ) : (
                    <button onClick={() => toggleReveal(branch.point.id)} className="mt-0.5 text-xs font-medium text-ink-muted underline decoration-dotted hover:text-ink">
                      👁 Xem nghĩa
                    </button>
                  )}
                  <button
                    onClick={() => handleSpeak(branch.example.sentence)}
                    aria-label="Đọc to"
                    className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface-2 text-[11px] shadow hover:bg-surface-3"
                  >
                    🔊
                  </button>
                  <button
                    onClick={() => setActivePointId((id) => (id === branch.point.id ? null : branch.point.id))}
                    aria-label="Xem chi tiết"
                    className="absolute -bottom-2 -left-2 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface-2 text-[11px] font-bold text-ink-muted shadow hover:bg-surface-3"
                  >
                    i
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="mt-2 text-center text-xs text-ink-muted">
        🔊 nghe câu · 👁 xem nghĩa · <span className="font-semibold">i</span> xem chi tiết cấu trúc ·
        kéo nền để di chuyển
      </p>

      {ttsWarning && (
        <p className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
          🔇 {ttsWarning}
          <button onClick={() => setTtsWarning(null)} className="font-semibold underline">
            Đóng
          </button>
        </p>
      )}

      {activeItem && activeColor && (
        <GrammarPointDetailModal
          point={activeItem.point}
          lang={lang}
          colorText={activeColor.text}
          extras={extras}
          addingExampleId={addingExampleId}
          addingMnemonicId={addingMnemonicId}
          aiError={aiError}
          onAddExample={() => addExample(activeItem.point)}
          onAddMnemonic={() => addMnemonic(activeItem.point)}
          onSpeak={handleSpeak}
          onClose={() => setActivePointId(null)}
        />
      )}
    </div>
  );
}
