"use client";

import { useEffect, useRef, useState } from "react";
import type { Language } from "@/types/vocab";
import type { ResolvedGrammarStory } from "@/lib/grammarStories";
import { curvePath } from "@/lib/mindmapLayout";
import { branchColor } from "@/lib/mindmapColors";
import { speak, ttsFailureMessage } from "@/lib/tts";
import { useGrammarExtras } from "@/lib/useGrammarExtras";
import GrammarPointDetailModal from "@/components/grammar/GrammarPointDetailModal";
import StoryNodeSentence from "@/components/grammar/StoryNodeSentence";

/** Canvas cho "chuỗi ngữ cảnh" — khác mindmap (toả nhánh từ 1 tâm) ở chỗ đây là 1 CHUỖI TUYẾN TÍNH có
 * thứ tự (câu chuyện đọc từ trái sang phải), nên node KHÔNG kéo thả được (thứ tự phải giữ nguyên) —
 * chỉ nền được kéo (pan) để xem chuỗi dài. Giữa 2 node liên tiếp là nhãn giải thích điểm ngữ pháp của
 * bước kế tiếp (cách chia/dấu hiệu nhận biết + lỗi hay gặp nếu có), bấm vào nhãn để xem chi tiết đầy
 * đủ — đúng yêu cầu "giữa các node có giải thích thì ngữ pháp, dấu hiệu nhận biết, hay ngoại lệ". */
const NODE_W = 240;
const STEP_X = 320;
const START_X = 160;
const ROW_Y = 160;
const LABEL_Y = 280;
const MARGIN = 80;

export default function GrammarStoryCanvas({ story, lang }: { story: ResolvedGrammarStory; lang: Language }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [activePointId, setActivePointId] = useState<string | null>(null);
  const [ttsWarning, setTtsWarning] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Ẩn nghĩa tiếng Việt mặc định — hiện song song với câu gốc thì không luyện được phản xạ đọc-hiểu.
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const { extras, addingExampleId, addingMnemonicId, aiError, addExample, addMnemonic } = useGrammarExtras(lang);

  function toggleReveal(id: string) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

  const width = START_X + STEP_X * (story.steps.length - 1) + NODE_W / 2 + MARGIN;
  const height = LABEL_Y + 140;

  const activeStep = story.steps.find((s) => s.point.id === activePointId);
  const activeColor = activeStep ? branchColor(story.steps.indexOf(activeStep)) : null;

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
              {story.steps.slice(1).map((_, i) => {
                const x1 = START_X + STEP_X * i + NODE_W / 2;
                const x2 = START_X + STEP_X * (i + 1) - NODE_W / 2;
                const color = branchColor(i + 1);
                return (
                  <path
                    key={`line-${i}`}
                    d={curvePath(x1, ROW_Y, x2, ROW_Y, 1)}
                    stroke={color.stroke}
                    strokeWidth={2.5}
                    fill="none"
                    opacity={0.7}
                  />
                );
              })}
            </svg>

            {story.steps.map((step, i) => {
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
                    <button
                      onClick={() => toggleReveal(step.point.id)}
                      className="mt-0.5 text-xs font-medium text-ink-muted underline decoration-dotted hover:text-ink"
                    >
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
                </div>
              );
            })}

            {story.steps.map((step, i) => {
              if (i === 0) return null;
              const color = branchColor(i);
              const x1 = START_X + STEP_X * (i - 1) + NODE_W / 2;
              const x2 = START_X + STEP_X * i - NODE_W / 2;
              const midX = (x1 + x2) / 2;
              return (
                <button
                  key={`label-${step.point.id}`}
                  data-story-node
                  onClick={() => setActivePointId(step.point.id)}
                  style={{ left: midX, top: LABEL_Y, width: 220 }}
                  className={`absolute -translate-x-1/2 rounded-lg border ${color.border} bg-surface px-2.5 py-2 text-left shadow-sm hover:brightness-95`}
                >
                  <div className={`text-xs font-bold ${color.text}`}>{step.point.pattern}</div>
                  <div className="mt-0.5 text-[11px] text-ink-muted">{step.point.formationRule}</div>
                  {step.point.commonMistakeVn ? (
                    <div className="mt-0.5 text-[11px] text-red-600 dark:text-red-400">
                      ⚠️ {step.point.commonMistakeVn}
                    </div>
                  ) : (
                    <div className="mt-0.5 text-[11px] text-ink-muted">💡 {step.point.mnemonicVn}</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <p className="mt-2 text-center text-xs text-ink-muted">
        🔊 nghe câu · bấm nhãn giữa 2 câu để xem cách chia/dấu hiệu nhận biết đầy đủ · kéo nền để di
        chuyển
      </p>

      {ttsWarning && (
        <p className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
          🔇 {ttsWarning}
          <button onClick={() => setTtsWarning(null)} className="font-semibold underline">
            Đóng
          </button>
        </p>
      )}

      {activeStep && activeColor && (
        <GrammarPointDetailModal
          point={activeStep.point}
          lang={lang}
          colorText={activeColor.text}
          extras={extras}
          addingExampleId={addingExampleId}
          addingMnemonicId={addingMnemonicId}
          aiError={aiError}
          onAddExample={() => addExample(activeStep.point)}
          onAddMnemonic={() => addMnemonic(activeStep.point)}
          onSpeak={handleSpeak}
          onClose={() => setActivePointId(null)}
        />
      )}
    </div>
  );
}
