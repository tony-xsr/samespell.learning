"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TopicGroup } from "@/types/topic";
import {
  buildTopicMindmapLayout,
  type PositionedWord,
  type TopicMindmapOrientation,
} from "@/lib/topicMindmapLayout";
import { curvePath } from "@/lib/mindmapLayout";
import { branchColor, type BranchColor } from "@/lib/mindmapColors";
import { speak, ttsFailureMessage } from "@/lib/tts";

function SpeakBadge({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Đọc to"
      className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface-2 text-[11px] shadow hover:bg-surface-3"
    >
      🔊
    </button>
  );
}

function InfoBadge({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Xem thêm"
      className="absolute -bottom-2 -left-2 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface-2 text-[11px] font-bold text-ink-muted shadow hover:bg-surface-3"
    >
      i
    </button>
  );
}

const PAN_SLACK = 300;
const PORTRAIT_BREAKPOINT = 640;
const DRAG_THRESHOLD = 4;

function findPositionedWord(nodes: PositionedWord[], id: string): PositionedWord | undefined {
  for (const n of nodes) {
    if (n.word.id === id) return n;
    const found = findPositionedWord(n.children, id);
    if (found) return found;
  }
  return undefined;
}

interface DragState {
  id: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  moved: boolean;
}

export default function TopicMindmapCanvas({ topic }: { topic: TopicGroup }) {
  const [orientation, setOrientation] = useState<TopicMindmapOrientation>("horizontal");
  const layout = useMemo(() => buildTopicMindmapLayout(topic, orientation), [topic, orientation]);
  const [zoom, setZoom] = useState(1);
  const [activeWordId, setActiveWordId] = useState<string | null>(null);
  const [nodeOverrides, setNodeOverrides] = useState<Record<string, { x: number; y: number }>>({});
  const viewportRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedForRef = useRef<string | null>(null);
  const dragRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);
  const dragNodeRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [ttsWarning, setTtsWarning] = useState<string | null>(null);

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
      containerRef.current?.requestFullscreen().catch(() => {
        // trình duyệt/thiết bị không hỗ trợ Fullscreen API — bỏ qua
      });
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(1.8, +(z + 0.1).toFixed(2)));
      else if (e.key === "-") setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)));
      else if (e.key === "0") resetView();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSpeak(text: string) {
    speak(text, topic.language).then((r) => {
      setTtsWarning(r.ok ? null : ttsFailureMessage(r.reason));
    });
  }

  useEffect(() => {
    function update() {
      const portrait = window.innerWidth < PORTRAIT_BREAKPOINT && window.innerHeight >= window.innerWidth;
      setOrientation(portrait ? "vertical" : "horizontal");
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  useEffect(() => {
    setNodeOverrides({});
  }, [topic.id, orientation]);

  function fitZoom(el: HTMLDivElement): number {
    const raw = Math.min(
      (el.clientWidth - 24) / layout.width,
      (el.clientHeight - 24) / layout.height,
      1,
    );
    return Math.max(0.5, Math.round(raw * 20) / 20);
  }

  useEffect(() => {
    const el = viewportRef.current;
    const key = `${topic.id}:${orientation}:${isFullscreen}`;
    if (!el || initializedForRef.current === key) return;
    initializedForRef.current = key;
    setZoom(fitZoom(el));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic.id, orientation, layout, isFullscreen]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollLeft = PAN_SLACK + layout.centerX * zoom - el.clientWidth / 2;
    el.scrollTop = PAN_SLACK + layout.centerY * zoom - el.clientHeight / 2;
  }, [topic.id, orientation, layout, zoom]);

  useEffect(() => {
    function applyDelta(clientX: number, clientY: number) {
      const drag = dragRef.current;
      const el = viewportRef.current;
      if (!drag || !el) return;
      el.scrollLeft = drag.scrollLeft - (clientX - drag.x);
      el.scrollTop = drag.scrollTop - (clientY - drag.y);
    }
    function handleMouseMove(e: MouseEvent) {
      applyDelta(e.clientX, e.clientY);
    }
    function handleTouchMove(e: TouchEvent) {
      const point = e.touches[0];
      if (!point || !dragRef.current) return;
      applyDelta(point.clientX, point.clientY);
      e.preventDefault();
    }
    function handleEnd() {
      dragRef.current = null;
      setIsDragging(false);
    }
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleEnd);
    window.addEventListener("touchcancel", handleEnd);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleEnd);
      window.removeEventListener("touchcancel", handleEnd);
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    function handleMove(e: PointerEvent) {
      const drag = dragNodeRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      const dx = (e.clientX - drag.startClientX) / zoom;
      const dy = (e.clientY - drag.startClientY) / zoom;
      if (Math.abs(e.clientX - drag.startClientX) > DRAG_THRESHOLD || Math.abs(e.clientY - drag.startClientY) > DRAG_THRESHOLD) {
        drag.moved = true;
      }
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setNodeOverrides((prev) => ({ ...prev, [drag.id]: { x: drag.startX + dx, y: drag.startY + dy } }));
      });
    }
    function handleUp(e: PointerEvent) {
      const drag = dragNodeRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      if (drag.moved) suppressClickRef.current.add(drag.id);
      dragNodeRef.current = null;
    }
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [zoom]);

  function pos(id: string, x: number, y: number): { x: number; y: number } {
    return nodeOverrides[id] ?? { x, y };
  }

  function handleNodeDragStart(e: React.PointerEvent, id: string, x: number, y: number) {
    if ((e.target as HTMLElement).closest("button")) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const current = pos(id, x, y);
    dragNodeRef.current = {
      id,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: current.x,
      startY: current.y,
      moved: false,
    };
  }

  function handleNodeClick(id: string, onSpeak: () => void) {
    if (suppressClickRef.current.has(id)) {
      suppressClickRef.current.delete(id);
      return;
    }
    onSpeak();
  }

  function handleCanvasMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("[data-node-drag]")) return;
    const el = viewportRef.current;
    if (!el) return;
    e.preventDefault();
    dragRef.current = { x: e.clientX, y: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop };
    setIsDragging(true);
  }

  function handleCanvasTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("[data-node-drag]")) return;
    const el = viewportRef.current;
    const point = e.touches[0];
    if (!el || !point) return;
    dragRef.current = { x: point.clientX, y: point.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop };
    setIsDragging(true);
  }

  function resetView() {
    const el = viewportRef.current;
    if (!el) return;
    setNodeOverrides({});
    setZoom(fitZoom(el));
  }

  function closeOverlays() {
    setActiveWordId(null);
  }

  const activeWord = useMemo(() => {
    if (!activeWordId) return null;
    for (const bn of layout.branches) {
      const wn = findPositionedWord(bn.words, activeWordId);
      if (wn) return { wn, color: branchColor(bn.colorIndex) };
    }
    return null;
  }, [layout, activeWordId]);

  useEffect(() => {
    if (!activeWordId) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeOverlays();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeWordId]);

  function renderConnectors(
    parentX: number,
    parentY: number,
    pw: PositionedWord,
    side: -1 | 1,
    color: BranchColor,
    key: string,
  ): React.ReactNode[] {
    const p = pos(pw.word.id, pw.x, pw.y);
    // Từ lõi (tầng đầu của nhánh) vẽ nét liền; từ liên quan/đồng nghĩa mở rộng (children) vẽ nét đứt
    // để phân biệt trực quan với quan hệ chủ đề → nhánh → từ lõi, giống ảnh mindmap tham khảo.
    const isRelated = key.includes("-c");
    const lines: React.ReactNode[] = [
      <path
        key={key}
        d={curvePath(parentX, parentY, p.x, p.y, side)}
        stroke={color.stroke}
        strokeWidth={1.5}
        strokeDasharray={isRelated ? "4 3" : undefined}
        fill="none"
        opacity={0.5}
      />,
    ];
    pw.children.forEach((child, i) => {
      lines.push(...renderConnectors(p.x, p.y, child, side, color, `${key}-c${i}`));
    });
    return lines;
  }

  function renderWordNode(pw: PositionedWord, color: BranchColor, isCore: boolean): React.ReactNode {
    const word = pw.word;
    const p = pos(word.id, pw.x, pw.y);
    return (
      <div key={word.id}>
        <div
          data-node-drag
          style={{ left: p.x, top: p.y, width: 168, touchAction: "none" }}
          className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-lg border px-2.5 py-1.5 text-center shadow-sm active:scale-95 active:cursor-grabbing ${
            isCore ? `border-2 ${color.border} ${color.bg}` : `${color.border} bg-surface-2`
          }`}
          onPointerDown={(e) => handleNodeDragStart(e, word.id, pw.x, pw.y)}
          onClick={() => handleNodeClick(word.id, () => handleSpeak(word.headword))}
        >
          <div className="text-sm font-semibold whitespace-nowrap text-ink">{word.headword}</div>
          {word.reading && <div className="text-[11px] text-ink-muted italic">{word.reading}</div>}
          <div className={`text-xs font-medium ${color.text}`}>{word.meaningVn}</div>

          <SpeakBadge
            onClick={(e) => {
              e.stopPropagation();
              handleSpeak(word.headword);
            }}
          />
          <InfoBadge
            onClick={(e) => {
              e.stopPropagation();
              closeOverlays();
              setActiveWordId((id) => (id === word.id ? null : word.id));
            }}
          />
        </div>
        {pw.children.map((child) => renderWordNode(child, color, false))}
      </div>
    );
  }

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
          onClick={() => setZoom((z) => Math.min(1.8, +(z + 0.1).toFixed(2)))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-2 text-sm text-ink hover:border-brand-300 hover:bg-surface-3"
          aria-label="Phóng to"
        >
          +
        </button>
        <button
          onClick={resetView}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-2 text-sm text-ink hover:border-brand-300 hover:bg-surface-3"
          aria-label="Về giữa"
        >
          ⟲
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
        className={`${isFullscreen ? "flex-1" : "h-[70vh]"} min-h-[380px] w-full overflow-auto rounded-2xl border border-border bg-surface-3/40`}
      >
        <div style={{ width: layout.width * zoom, height: layout.height * zoom, margin: PAN_SLACK }}>
          <div
            style={{
              width: layout.width,
              height: layout.height,
              transform: `scale(${zoom})`,
              transformOrigin: "0 0",
              touchAction: "none",
            }}
            className={`relative select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
            onMouseDown={handleCanvasMouseDown}
            onTouchStart={handleCanvasTouchStart}
          >
            <svg width={layout.width} height={layout.height} className="pointer-events-none absolute inset-0">
              {layout.branches.map((bn) => {
                const color = branchColor(bn.colorIndex);
                const bp = pos(bn.branch.id, bn.x, bn.y);
                return (
                  <g key={`lines-${bn.branch.id}`}>
                    <path
                      d={curvePath(layout.centerX, layout.centerY, bp.x, bp.y, bn.side)}
                      stroke={color.stroke}
                      strokeWidth={2.5}
                      fill="none"
                      opacity={0.7}
                    />
                    {bn.words.flatMap((wn, i) =>
                      renderConnectors(bp.x, bp.y, wn, bn.side, color, `${bn.branch.id}-w${i}`),
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Center node */}
            <div
              style={{ left: layout.centerX, top: layout.centerY }}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-brand-500 bg-brand-50 px-6 py-4 text-center shadow-md"
            >
              <div className="text-lg font-bold whitespace-nowrap text-ink">{topic.titleNative}</div>
              <div className="mt-0.5 text-xs text-ink-muted">{topic.titleVn}</div>
            </div>

            {layout.branches.map((bn) => {
              const color = branchColor(bn.colorIndex);
              const bp = pos(bn.branch.id, bn.x, bn.y);
              return (
                <div key={bn.branch.id}>
                  <div
                    data-node-drag
                    style={{ left: bp.x, top: bp.y, width: 190, touchAction: "none" }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-xl border-2 ${color.border} ${color.bg} px-3 py-2 text-center shadow-sm active:scale-95 active:cursor-grabbing`}
                    onPointerDown={(e) => handleNodeDragStart(e, bn.branch.id, bn.x, bn.y)}
                    onClick={() => handleNodeClick(bn.branch.id, () => handleSpeak(bn.branch.titleNative))}
                  >
                    <div className="text-lg font-bold text-ink">{bn.branch.titleNative}</div>
                    <div className={`text-sm font-semibold ${color.text}`}>{bn.branch.titleVn}</div>
                    <SpeakBadge
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSpeak(bn.branch.titleNative);
                      }}
                    />
                  </div>

                  {bn.words.map((wn) => renderWordNode(wn, color, true))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {activeWord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setActiveWordId(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border-strong bg-surface-2 p-5 text-left shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-3xl font-bold text-ink">{activeWord.wn.word.headword}</div>
                {activeWord.wn.word.reading && (
                  <div className="mt-0.5 text-lg text-ink-muted italic">{activeWord.wn.word.reading}</div>
                )}
                <div className={`mt-1 text-base font-semibold ${activeWord.color.text}`}>
                  {activeWord.wn.word.meaningVn}
                </div>
              </div>
              <button
                onClick={() => setActiveWordId(null)}
                aria-label="Đóng"
                className="shrink-0 rounded-full border border-border bg-surface-3 px-2.5 py-1 text-sm text-ink-muted hover:bg-surface"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 rounded-xl bg-surface-3/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="text-lg text-ink">{activeWord.wn.word.example}</div>
                <button
                  onClick={() => handleSpeak(activeWord.wn.word.example)}
                  aria-label="Đọc ví dụ"
                  className="shrink-0 rounded-full border border-border bg-surface-2 px-2 py-1.5 text-sm hover:bg-surface"
                >
                  🔊
                </button>
              </div>
              <div className="mt-1.5 text-sm text-ink-muted">{activeWord.wn.word.exampleVn}</div>
            </div>
          </div>
        </div>
      )}

      <p className="mt-2 text-center text-xs text-ink-muted">
        Chạm từ để nghe · <span className="font-semibold">i</span> xem thêm · nét đứt = từ liên
        quan/đồng nghĩa · kéo thẻ lại gần hoặc kéo nền để di chuyển
      </p>

      {ttsWarning && (
        <p className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          🔇 {ttsWarning}
          <button onClick={() => setTtsWarning(null)} className="font-semibold underline">
            Đóng
          </button>
        </p>
      )}
    </div>
  );
}
