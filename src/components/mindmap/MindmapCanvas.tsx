"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RootEntry, SoundGroup, VocabWord } from "@/types/vocab";
import {
  buildMindmapLayout,
  curvePath,
  type MindmapOrientation,
  type PositionedWord,
} from "@/lib/mindmapLayout";
import { branchColor, type BranchColor } from "@/lib/mindmapColors";
import { speak, ttsFailureMessage } from "@/lib/tts";
import { toPinyin } from "@/lib/zhPinyin";

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

function FavoriteBadge({ active, onClick }: { active: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={active ? "Bỏ yêu thích" : "Đánh dấu yêu thích"}
      className={`absolute -top-2 -left-2 flex h-6 w-6 items-center justify-center rounded-full border text-xs shadow ${
        active
          ? "border-amber-400 bg-amber-100 text-amber-600"
          : "border-border bg-surface-2 text-ink-muted hover:bg-surface-3"
      }`}
    >
      {active ? "★" : "☆"}
    </button>
  );
}

function ExpandBranchBadge({
  loading,
  onClick,
}: {
  loading: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      aria-label="Mở rộng nhánh từ từ này"
      className="absolute -right-2 -bottom-2 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface-2 text-[11px] shadow hover:bg-surface-3 disabled:opacity-50"
    >
      {loading ? "…" : "🌿"}
    </button>
  );
}

// Khoảng đệm quanh canvas để luôn có chỗ kéo thả (pan), kể cả khi mindmap nhỏ và vừa khít
// màn hình ở zoom mặc định — nếu không thì scrollWidth == clientWidth và kéo không có tác dụng.
const PAN_SLACK = 300;
// Dưới ngưỡng này (và cao hơn rộng, tức đang cầm dọc) thì chuyển layout dọc cho dễ kéo lên/xuống.
const PORTRAIT_BREAKPOINT = 640;
// Kéo bao nhiêu px màn hình mới tính là "đã kéo" (để phân biệt với 1 cú chạm/click đứng yên).
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

export default function MindmapCanvas({
  group,
  onExpandRoot,
  expandingRootId,
  onFindNewRoot,
  findingRoot,
  onGetMnemonic,
  mnemonicLoadingId,
  onExpandWord,
  expandingWordId,
  bookmarkedIds,
  onToggleBookmark,
}: {
  group: SoundGroup;
  onExpandRoot: (root: RootEntry) => void;
  expandingRootId: string | null;
  onFindNewRoot: () => void;
  findingRoot: boolean;
  onGetMnemonic: (word: VocabWord) => void;
  mnemonicLoadingId: string | null;
  onExpandWord: (word: VocabWord) => void;
  expandingWordId: string | null;
  bookmarkedIds: Set<string>;
  onToggleBookmark: (wordId: string) => void;
}) {
  const [orientation, setOrientation] = useState<MindmapOrientation>("horizontal");
  const layout = useMemo(() => buildMindmapLayout(group, orientation), [group, orientation]);
  const [zoom, setZoom] = useState(1);
  const [activeWordId, setActiveWordId] = useState<string | null>(null);
  const [activeRootId, setActiveRootId] = useState<string | null>(null);
  const [pendingExpandRootId, setPendingExpandRootId] = useState<string | null>(null);
  const [pendingFindNewRoot, setPendingFindNewRoot] = useState(false);
  const [pendingExpandWord, setPendingExpandWord] = useState<PositionedWord | null>(null);
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
        // trình duyệt/thiết bị không hỗ trợ Fullscreen API — bỏ qua, không có gì để rollback
      });
    }
  }

  // Phím tắt: +/- để zoom, 0 để về giữa, bỏ qua khi đang gõ vào 1 ô nhập liệu khác trên trang.
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
    speak(text, group.language).then((r) => {
      setTtsWarning(r.ok ? null : ttsFailureMessage(r.reason));
    });
  }

  // Điện thoại cầm dọc & màn hình hẹp → chuyển sang layout dọc (1 cột), dễ kéo lên/xuống hơn là
  // phải kéo ngang rộng như layout trái/phải mặc định trên desktop.
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

  // Đổi nhóm hoặc đổi hướng layout → vị trí đã kéo tay không còn hợp lệ, xoá đi để dùng layout mới.
  useEffect(() => {
    setNodeOverrides({});
  }, [group.id, orientation]);

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
    const key = `${group.id}:${orientation}:${isFullscreen}`;
    if (!el || initializedForRef.current === key) return;
    initializedForRef.current = key;
    setZoom(fitZoom(el));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id, orientation, layout, isFullscreen]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollLeft = PAN_SLACK + layout.centerX * zoom - el.clientWidth / 2;
    el.scrollTop = PAN_SLACK + layout.centerY * zoom - el.clientHeight / 2;
  }, [group.id, orientation, layout, zoom]);

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

  // Kéo TỪNG thẻ (root/word) lại gần nhau — tách biệt với kéo nền (pan) ở trên. Cập nhật vị trí
  // qua requestAnimationFrame để dây nối vẽ lại mượt, không bắn state dồn dập hơn 1 lần/frame.
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
    // stopPropagation() trong handleNodeDragStart chỉ chặn các listener "pointerdown" khác — sự
    // kiện "mousedown" gốc (native) vẫn nổi bọt lên đây độc lập, nên phải tự loại trừ bằng marker
    // data-node-drag, nếu không nền sẽ vừa pan vừa kéo thẻ cùng lúc, khiến thẻ di chuyển sai lệch.
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
    setActiveRootId(null);
    setPendingExpandWord(null);
  }

  const activeWord = useMemo(() => {
    if (!activeWordId) return null;
    for (const rn of layout.roots) {
      const wn = findPositionedWord(rn.words, activeWordId);
      if (wn) return { wn, color: branchColor(rn.colorIndex) };
    }
    return null;
  }, [layout, activeWordId]);

  const activeRoot = useMemo(() => {
    const rn = layout.roots.find((r) => r.root.id === activeRootId);
    return rn ? { rn, color: branchColor(rn.colorIndex) } : null;
  }, [layout, activeRootId]);

  const examplePinyin = useMemo(() => {
    if (!activeWord || group.language !== "zh") return "";
    return toPinyin(activeWord.wn.word.example);
  }, [activeWord, group.language]);

  // Đóng modal/overlay bằng phím Esc cho tiện dùng bàn phím.
  useEffect(() => {
    if (!activeWordId && !activeRootId) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeOverlays();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeWordId, activeRootId]);

  function renderConnectors(
    parentX: number,
    parentY: number,
    pw: PositionedWord,
    side: -1 | 1,
    color: BranchColor,
    key: string,
  ): React.ReactNode[] {
    const p = pos(pw.word.id, pw.x, pw.y);
    const lines: React.ReactNode[] = [
      <path
        key={key}
        d={curvePath(parentX, parentY, p.x, p.y, side)}
        stroke={color.stroke}
        strokeWidth={1.5}
        fill="none"
        opacity={0.45}
      />,
    ];
    pw.children.forEach((child, i) => {
      lines.push(...renderConnectors(p.x, p.y, child, side, color, `${key}-${i}`));
    });
    return lines;
  }

  function renderWordNode(pw: PositionedWord, color: BranchColor): React.ReactNode {
    const word = pw.word;
    const isBookmarked = bookmarkedIds.has(word.id);
    const p = pos(word.id, pw.x, pw.y);
    return (
      <div key={word.id}>
        <div
          data-node-drag
          style={{ left: p.x, top: p.y, width: 170, touchAction: "none" }}
          className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-lg border ${color.border} ${color.bg} px-2.5 py-1.5 text-center shadow-sm active:scale-95 active:cursor-grabbing`}
          onPointerDown={(e) => handleNodeDragStart(e, word.id, pw.x, pw.y)}
          onClick={() => handleNodeClick(word.id, () => handleSpeak(word.headword))}
        >
          <div className="text-sm font-semibold whitespace-nowrap text-ink">{word.headword}</div>
          <div className="text-[11px] text-ink-muted italic">{word.reading}</div>
          <div className={`text-xs font-medium ${color.text}`}>{word.meaningVn}</div>

          <FavoriteBadge
            active={isBookmarked}
            onClick={(e) => {
              e.stopPropagation();
              onToggleBookmark(word.id);
            }}
          />
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
          <ExpandBranchBadge
            loading={expandingWordId === word.id}
            onClick={(e) => {
              e.stopPropagation();
              closeOverlays();
              setPendingExpandWord((p) => (p?.word.id === word.id ? null : pw));
            }}
          />
        </div>
        {pw.children.map((child) => renderWordNode(child, color))}
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
            <svg
              width={layout.width}
              height={layout.height}
              className="pointer-events-none absolute inset-0"
            >
              {layout.roots.map((rn) => {
                const color = branchColor(rn.colorIndex);
                const rp = pos(rn.root.id, rn.x, rn.y);
                return (
                  <g key={`lines-${rn.root.id}`}>
                    <path
                      d={curvePath(layout.centerX, layout.centerY, rp.x, rp.y, rn.side)}
                      stroke={color.stroke}
                      strokeWidth={2.5}
                      fill="none"
                      opacity={0.7}
                    />
                    {rn.words.flatMap((wn, i) =>
                      renderConnectors(rp.x, rp.y, wn, rn.side, color, `${rn.root.id}-w${i}`),
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
              <div className="text-2xl font-bold whitespace-nowrap text-ink">{group.reading}</div>
              <div className="mt-0.5 text-xs text-ink-muted">
                {group.roots.length} chữ {group.groupKind === "shape" ? "đồng dạng" : "đồng âm"}
              </div>
            </div>

            {layout.roots.map((rn) => {
              const color = branchColor(rn.colorIndex);
              const rp = pos(rn.root.id, rn.x, rn.y);
              return (
                <div key={rn.root.id}>
                  {/* Root node */}
                  <div
                    data-node-drag
                    style={{ left: rp.x, top: rp.y, width: 190, touchAction: "none" }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-xl border-2 ${color.border} ${color.bg} px-3 py-2 text-center shadow-sm active:scale-95 active:cursor-grabbing`}
                    onPointerDown={(e) => handleNodeDragStart(e, rn.root.id, rn.x, rn.y)}
                    onClick={() => handleNodeClick(rn.root.id, () => handleSpeak(rn.root.character))}
                  >
                    <div className="text-lg font-bold text-ink">
                      {rn.root.character}
                      {rn.root.hanViet && (
                        <span className="ml-1 text-xs font-normal text-ink-muted italic">
                          ({rn.root.hanViet})
                        </span>
                      )}
                    </div>
                    <div className={`text-sm font-semibold ${color.text}`}>{rn.root.meaningVn}</div>

                    {pendingExpandRootId === rn.root.id ? (
                      <div className="mt-1 flex items-center justify-center gap-1.5 text-[11px]">
                        <span className="text-ink-muted">Mở rộng?</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingExpandRootId(null);
                            onExpandRoot(rn.root);
                          }}
                          className="font-semibold text-green-600 hover:underline"
                        >
                          Có
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingExpandRootId(null);
                          }}
                          className="font-semibold text-ink-muted hover:underline"
                        >
                          Không
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingExpandRootId(rn.root.id);
                        }}
                        disabled={expandingRootId === rn.root.id}
                        className="mt-1 text-[11px] text-ink-muted underline decoration-dotted hover:text-ink disabled:opacity-50"
                      >
                        {expandingRootId === rn.root.id ? "Đang tạo…" : "✨ Thêm từ"}
                      </button>
                    )}

                    <InfoBadge
                      onClick={(e) => {
                        e.stopPropagation();
                        closeOverlays();
                        setActiveRootId((id) => (id === rn.root.id ? null : rn.root.id));
                      }}
                    />
                    <SpeakBadge
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSpeak(rn.root.character);
                      }}
                    />
                  </div>

                  {rn.words.map((wn) => renderWordNode(wn, color))}
                </div>
              );
            })}

            {pendingExpandWord &&
              (() => {
                const p = pos(pendingExpandWord.word.id, pendingExpandWord.x, pendingExpandWord.y);
                return (
                  <div
                    style={{ left: p.x, top: p.y + 46 }}
                    className="absolute z-50 w-52 -translate-x-1/2 rounded-xl border-2 border-border-strong bg-surface-2 p-3 text-center text-xs text-ink shadow-xl"
                  >
                    <div className="mb-2">
                      Mở rộng nhánh từ &ldquo;{pendingExpandWord.word.headword}&rdquo;?
                    </div>
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => {
                          onExpandWord(pendingExpandWord.word);
                          setPendingExpandWord(null);
                        }}
                        className="rounded-full bg-green-600 px-3 py-1 font-semibold text-white hover:bg-green-700"
                      >
                        Có
                      </button>
                      <button
                        onClick={() => setPendingExpandWord(null)}
                        className="rounded-full border border-border px-3 py-1 font-semibold text-ink-muted hover:bg-surface-3"
                      >
                        Không
                      </button>
                    </div>
                  </div>
                );
              })()}
          </div>
        </div>
      </div>

      {/* Modal phóng to chi tiết 1 từ — thay cho popup nhỏ gắn cạnh thẻ, dễ đọc hơn nhiều,
          nhất là trên điện thoại. */}
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
                <div className="mt-0.5 text-lg text-ink-muted italic">{activeWord.wn.word.reading}</div>
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
              {examplePinyin && (
                <div className="mt-1 text-sm text-ink-muted italic">{examplePinyin}</div>
              )}
              <div className="mt-1.5 text-sm text-ink-muted">{activeWord.wn.word.exampleVn}</div>
            </div>

            {activeWord.wn.word.grammarPoint && (
              <div className="mt-3 rounded-md bg-indigo-50 px-3 py-2 text-sm text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                <div className="font-semibold">📚 {activeWord.wn.word.grammarPoint}</div>
                {activeWord.wn.word.grammarExplanationVn && (
                  <div className="mt-0.5">{activeWord.wn.word.grammarExplanationVn}</div>
                )}
              </div>
            )}

            {activeWord.wn.word.mnemonicVn ? (
              <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                💡 {activeWord.wn.word.mnemonicVn}
              </div>
            ) : (
              <button
                onClick={() => onGetMnemonic(activeWord.wn.word)}
                disabled={mnemonicLoadingId === activeWord.wn.word.id}
                className="mt-3 text-sm font-medium text-amber-600 underline decoration-dotted hover:text-amber-700 disabled:opacity-50"
              >
                {mnemonicLoadingId === activeWord.wn.word.id ? "Đang nghĩ mẹo nhớ…" : "💡 Xem mẹo nhớ"}
              </button>
            )}
          </div>
        </div>
      )}

      {activeRoot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setActiveRootId(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border-strong bg-surface-2 p-5 text-left shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="text-4xl font-bold text-ink">{activeRoot.rn.root.character}</div>
              <button
                onClick={() => setActiveRootId(null)}
                aria-label="Đóng"
                className="shrink-0 rounded-full border border-border bg-surface-3 px-2.5 py-1 text-sm text-ink-muted hover:bg-surface"
              >
                ✕
              </button>
            </div>
            <div className="mt-2 text-sm text-ink">
              {activeRoot.rn.root.hanViet && (
                <span className="font-semibold">Hán Việt: {activeRoot.rn.root.hanViet}. </span>
              )}
              {group.groupKind === "shape" ? (
                <>
                  Viết gần giống &ldquo;{group.reading}&rdquo; với {group.roots.length - 1} chữ khác
                  trong nhóm này, nhưng đọc và nghĩa hoàn toàn khác.
                </>
              ) : (
                <>
                  Cùng âm &ldquo;{group.reading}&rdquo; với {group.roots.length - 1} chữ khác trong
                  nhóm này, nhưng nghĩa hoàn toàn khác.
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <p className="mt-2 text-center text-xs text-ink-muted">
        Chạm từ để nghe · <span className="font-semibold">i</span> xem thêm ·{" "}
        <span className="font-semibold">🌿</span> mở rộng nhánh · kéo thẻ lại gần hoặc kéo nền để di
        chuyển
      </p>

      {ttsWarning && (
        <p className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          🔇 {ttsWarning}
          <button onClick={() => setTtsWarning(null)} className="font-semibold underline">
            Đóng
          </button>
        </p>
      )}

      {group.groupKind !== "shape" &&
        (pendingFindNewRoot ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ink-muted">Tìm chữ đồng âm mới bằng AI?</span>
            <button
              onClick={() => {
                setPendingFindNewRoot(false);
                onFindNewRoot();
              }}
              className="rounded-full bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
            >
              Có
            </button>
            <button
              onClick={() => setPendingFindNewRoot(false)}
              className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-ink-muted hover:bg-surface-3"
            >
              Không
            </button>
          </div>
        ) : (
          <button
            onClick={() => setPendingFindNewRoot(true)}
            disabled={findingRoot}
            className="mt-3 self-start rounded-full border-2 border-dashed border-brand-300 px-4 py-2 text-sm font-medium text-brand-600 hover:border-brand-400 hover:bg-brand-50 disabled:opacity-50"
          >
            {findingRoot ? "Đang tìm…" : `✨ AI: tìm thêm chữ đồng âm với "${group.reading}"`}
          </button>
        ))}
    </div>
  );
}
