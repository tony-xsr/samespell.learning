"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GrammarCategory } from "@/types/grammar";
import type { Language } from "@/types/vocab";
import {
  buildGrammarMindmapLayout,
  type GrammarMindmapOrientation,
  type PositionedGrammarPoint,
} from "@/lib/grammarMindmapLayout";
import { curvePath } from "@/lib/mindmapLayout";
import { branchColor } from "@/lib/mindmapColors";
import { speak, ttsFailureMessage } from "@/lib/tts";
import { useGrammarExtras } from "@/lib/useGrammarExtras";
import GrammarPointDetailModal from "@/components/grammar/GrammarPointDetailModal";

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
      aria-label="Xem chi tiết"
      className="absolute -bottom-2 -left-2 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface-2 text-[11px] font-bold text-ink-muted shadow hover:bg-surface-3"
    >
      i
    </button>
  );
}

const PAN_SLACK = 300;
const PORTRAIT_BREAKPOINT = 640;
const DRAG_THRESHOLD = 4;

interface DragState {
  id: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  moved: boolean;
}

export default function GrammarMindmapCanvas({
  category,
  lang,
}: {
  category: GrammarCategory;
  lang: Language;
}) {
  const [orientation, setOrientation] = useState<GrammarMindmapOrientation>("horizontal");
  const layout = useMemo(() => buildGrammarMindmapLayout(category, orientation), [category, orientation]);
  const [zoom, setZoom] = useState(1);
  const [activePointId, setActivePointId] = useState<string | null>(null);
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

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(1.8, +(z + 0.1).toFixed(2)));
      else if (e.key === "-") setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)));
      else if (e.key === "0") resetView();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSpeak(text: string) {
    speak(text, lang).then((r) => {
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
  }, [category.id, orientation]);

  // Chỉ fit theo CHIỀU RỘNG, không ép fit theo chiều cao — layout ngang có width gần như không đổi
  // dù nhóm có bao nhiêu điểm ngữ pháp (chỉ tăng CHIỀU CAO), nên nhóm đông (vd 27 điểm) trước đây bị
  // ép zoom xuống ~35% cho vừa khung nhìn, chữ quá nhỏ để đọc. Chiều cao dư ra thì cuộn (viewport đã
  // có overflow-auto), không cần nhồi hết vào 1 màn hình.
  function fitZoom(el: HTMLDivElement): number {
    const raw = Math.min((el.clientWidth - 24) / layout.width, 1);
    return Math.max(0.5, Math.round(raw * 20) / 20);
  }

  useEffect(() => {
    const el = viewportRef.current;
    const key = `${category.id}:${orientation}:${isFullscreen}`;
    if (!el || initializedForRef.current === key) return;
    initializedForRef.current = key;
    setZoom(fitZoom(el));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category.id, orientation, layout, isFullscreen]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollLeft = PAN_SLACK + layout.centerX * zoom - el.clientWidth / 2;
    el.scrollTop = PAN_SLACK + layout.centerY * zoom - el.clientHeight / 2;
  }, [category.id, orientation, layout, zoom]);

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

  const activePoint = useMemo(() => {
    const pn = layout.points.find((p) => p.point.id === activePointId);
    return pn ? { pn, color: branchColor(pn.colorIndex) } : null;
  }, [layout, activePointId]);

  useEffect(() => {
    if (!activePointId) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setActivePointId(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activePointId]);

  function renderNode(pn: PositionedGrammarPoint): React.ReactNode {
    const color = branchColor(pn.colorIndex);
    const p = pos(pn.point.id, pn.x, pn.y);
    return (
      <div
        key={pn.point.id}
        data-node-drag
        style={{ left: p.x, top: p.y, width: 200, touchAction: "none" }}
        className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-xl border-2 ${color.border} ${color.bg} px-3 py-2 text-center shadow-sm active:scale-95 active:cursor-grabbing`}
        onPointerDown={(e) => handleNodeDragStart(e, pn.point.id, pn.x, pn.y)}
        onClick={() => handleNodeClick(pn.point.id, () => handleSpeak(pn.point.pattern))}
      >
        <div className="text-base font-bold whitespace-nowrap text-ink">{pn.point.pattern}</div>
        <div className={`text-xs font-medium ${color.text}`}>{pn.point.meaningVn}</div>

        <SpeakBadge
          onClick={(e) => {
            e.stopPropagation();
            handleSpeak(pn.point.pattern);
          }}
        />
        <InfoBadge
          onClick={(e) => {
            e.stopPropagation();
            setActivePointId((id) => (id === pn.point.id ? null : pn.point.id));
          }}
        />
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${isFullscreen ? "flex h-full flex-col bg-surface p-3" : ""}`}>
      <div className="mb-2 flex items-center justify-end gap-1">
        <button
          onClick={() => setZoom((z) => Math.max(0.35, +(z - 0.1).toFixed(2)))}
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
              {layout.points.map((pn) => {
                const color = branchColor(pn.colorIndex);
                const p = pos(pn.point.id, pn.x, pn.y);
                return (
                  <path
                    key={`line-${pn.point.id}`}
                    d={curvePath(layout.centerX, layout.centerY, p.x, p.y, pn.side)}
                    stroke={color.stroke}
                    strokeWidth={2.5}
                    fill="none"
                    opacity={0.7}
                  />
                );
              })}
            </svg>

            <div
              style={{ left: layout.centerX, top: layout.centerY }}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-brand-500 bg-brand-50 px-6 py-4 text-center shadow-md"
            >
              <div className="text-lg font-bold whitespace-nowrap text-ink">{category.titleVn}</div>
              <div className="mt-0.5 text-xs text-ink-muted">{category.points.length} điểm ngữ pháp</div>
            </div>

            {layout.points.map(renderNode)}
          </div>
        </div>
      </div>

      {activePoint && (
        <GrammarPointDetailModal
          point={activePoint.pn.point}
          lang={lang}
          colorText={activePoint.color.text}
          extras={extras}
          addingExampleId={addingExampleId}
          addingMnemonicId={addingMnemonicId}
          aiError={aiError}
          onAddExample={() => addExample(activePoint.pn.point)}
          onAddMnemonic={() => addMnemonic(activePoint.pn.point)}
          onSpeak={handleSpeak}
          onClose={() => setActivePointId(null)}
        />
      )}

      <p className="mt-2 text-center text-xs text-ink-muted">
        Chạm cấu trúc để nghe · <span className="font-semibold">i</span> xem chi tiết · kéo thẻ lại
        gần hoặc kéo nền để di chuyển
      </p>

      {ttsWarning && (
        <p className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
          🔇 {ttsWarning}
          <button onClick={() => setTtsWarning(null)} className="font-semibold underline">
            Đóng
          </button>
        </p>
      )}
    </div>
  );
}
