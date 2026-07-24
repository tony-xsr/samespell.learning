"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RootEntry, SoundGroup, VocabWord } from "@/types/vocab";
import { buildMindmapLayout, curvePath, type PositionedWord } from "@/lib/mindmapLayout";
import { branchColor, type BranchColor } from "@/lib/mindmapColors";
import { speak, ttsFailureMessage } from "@/lib/tts";

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

function findPositionedWord(nodes: PositionedWord[], id: string): PositionedWord | undefined {
  for (const n of nodes) {
    if (n.word.id === id) return n;
    const found = findPositionedWord(n.children, id);
    if (found) return found;
  }
  return undefined;
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
  const layout = useMemo(() => buildMindmapLayout(group), [group]);
  const [zoom, setZoom] = useState(1);
  const [activeWordId, setActiveWordId] = useState<string | null>(null);
  const [activeRootId, setActiveRootId] = useState<string | null>(null);
  const [pendingExpandRootId, setPendingExpandRootId] = useState<string | null>(null);
  const [pendingFindNewRoot, setPendingFindNewRoot] = useState(false);
  const [pendingExpandWord, setPendingExpandWord] = useState<PositionedWord | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const initializedForRef = useRef<string | null>(null);
  const dragRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [ttsWarning, setTtsWarning] = useState<string | null>(null);

  function handleSpeak(text: string) {
    speak(text, group.language).then((r) => {
      setTtsWarning(r.ok ? null : ttsFailureMessage(r.reason));
    });
  }

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
    if (!el || initializedForRef.current === group.id) return;
    initializedForRef.current = group.id;
    setZoom(fitZoom(el));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id, layout]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollLeft = PAN_SLACK + layout.centerX * zoom - el.clientWidth / 2;
    el.scrollTop = PAN_SLACK + layout.centerY * zoom - el.clientHeight / 2;
  }, [group.id, layout, zoom]);

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

  function handleCanvasMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    const el = viewportRef.current;
    if (!el) return;
    e.preventDefault();
    dragRef.current = { x: e.clientX, y: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop };
    setIsDragging(true);
  }

  function handleCanvasTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    const el = viewportRef.current;
    const point = e.touches[0];
    if (!el || !point) return;
    dragRef.current = { x: point.clientX, y: point.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop };
    setIsDragging(true);
  }

  function resetView() {
    const el = viewportRef.current;
    if (!el) return;
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

  function renderConnectors(
    parentX: number,
    parentY: number,
    pw: PositionedWord,
    side: -1 | 1,
    color: BranchColor,
    key: string,
  ): React.ReactNode[] {
    const lines: React.ReactNode[] = [
      <path
        key={key}
        d={curvePath(parentX, parentY, pw.x, pw.y, side)}
        stroke={color.stroke}
        strokeWidth={1.5}
        fill="none"
        opacity={0.45}
      />,
    ];
    pw.children.forEach((child, i) => {
      lines.push(...renderConnectors(pw.x, pw.y, child, side, color, `${key}-${i}`));
    });
    return lines;
  }

  function renderWordNode(pw: PositionedWord, color: BranchColor): React.ReactNode {
    const word = pw.word;
    const isBookmarked = bookmarkedIds.has(word.id);
    return (
      <div key={word.id}>
        <div
          style={{ left: pw.x, top: pw.y, width: 170 }}
          className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-lg border ${color.border} ${color.bg} px-2.5 py-1.5 text-center shadow-sm active:scale-95`}
          onClick={() => handleSpeak(word.headword)}
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
    <div className="relative">
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
      </div>

      <div
        ref={viewportRef}
        className="h-[70vh] min-h-[380px] w-full overflow-auto rounded-2xl border border-border bg-surface-3/40"
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
                return (
                  <g key={`lines-${rn.root.id}`}>
                    <path
                      d={curvePath(layout.centerX, layout.centerY, rn.x, rn.y, rn.side)}
                      stroke={color.stroke}
                      strokeWidth={2.5}
                      fill="none"
                      opacity={0.7}
                    />
                    {rn.words.flatMap((wn, i) =>
                      renderConnectors(rn.x, rn.y, wn, rn.side, color, `${rn.root.id}-w${i}`),
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
              <div className="mt-0.5 text-xs text-ink-muted">{group.roots.length} chữ đồng âm</div>
            </div>

            {layout.roots.map((rn) => {
              const color = branchColor(rn.colorIndex);
              return (
                <div key={rn.root.id}>
                  {/* Root node */}
                  <div
                    style={{ left: rn.x, top: rn.y, width: 190 }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-xl border-2 ${color.border} ${color.bg} px-3 py-2 text-center shadow-sm active:scale-95`}
                    onClick={() => handleSpeak(rn.root.character)}
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

            {/* Info overlays — rendered last so they always paint above every node, regardless of side/order */}
            {activeWord && (
              <div
                style={{ left: activeWord.wn.x, top: activeWord.wn.y + 46 }}
                className="absolute z-50 w-60 -translate-x-1/2 rounded-xl border-2 border-border-strong bg-surface-2 p-2.5 text-left text-xs text-ink shadow-xl"
              >
                <button
                  onClick={() => setActiveWordId(null)}
                  className="absolute top-1 right-1.5 text-ink-muted hover:text-ink"
                  aria-label="Đóng"
                >
                  ✕
                </button>

                <div className="flex items-start justify-between gap-2 pr-4">
                  <div>
                    <div>{activeWord.wn.word.example}</div>
                    <div className="mt-1 text-ink-muted italic">{activeWord.wn.word.exampleVn}</div>
                  </div>
                  <button
                    onClick={() => handleSpeak(activeWord.wn.word.example)}
                    aria-label="Đọc ví dụ"
                    className="shrink-0 rounded-full border border-border bg-surface-3 px-1.5 py-1 text-xs hover:bg-surface"
                  >
                    🔊
                  </button>
                </div>

                {activeWord.wn.word.grammarPoint && (
                  <div className="mt-2 rounded-md bg-indigo-50 px-2 py-1 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                    <div className="font-semibold">📚 {activeWord.wn.word.grammarPoint}</div>
                    {activeWord.wn.word.grammarExplanationVn && (
                      <div className="mt-0.5">{activeWord.wn.word.grammarExplanationVn}</div>
                    )}
                  </div>
                )}

                {activeWord.wn.word.mnemonicVn ? (
                  <div className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                    💡 {activeWord.wn.word.mnemonicVn}
                  </div>
                ) : (
                  <button
                    onClick={() => onGetMnemonic(activeWord.wn.word)}
                    disabled={mnemonicLoadingId === activeWord.wn.word.id}
                    className="mt-2 text-[11px] font-medium text-amber-600 underline decoration-dotted hover:text-amber-700 disabled:opacity-50"
                  >
                    {mnemonicLoadingId === activeWord.wn.word.id
                      ? "Đang nghĩ mẹo nhớ…"
                      : "💡 Xem mẹo nhớ"}
                  </button>
                )}
              </div>
            )}

            {activeRoot && (
              <div
                style={{ left: activeRoot.rn.x, top: activeRoot.rn.y + 56 }}
                className="absolute z-50 w-56 -translate-x-1/2 rounded-xl border-2 border-border-strong bg-surface-2 p-2.5 text-left text-xs text-ink shadow-xl"
              >
                <button
                  onClick={() => setActiveRootId(null)}
                  className="absolute top-1 right-1.5 text-ink-muted hover:text-ink"
                  aria-label="Đóng"
                >
                  ✕
                </button>
                <div className="pr-4">
                  Chữ <span className="font-semibold">{activeRoot.rn.root.character}</span>
                  {activeRoot.rn.root.hanViet && ` (Hán Việt: ${activeRoot.rn.root.hanViet})`} — cùng âm
                  &ldquo;{group.reading}&rdquo; với {group.roots.length - 1} chữ khác trong nhóm này, nhưng
                  nghĩa hoàn toàn khác.
                </div>
              </div>
            )}

            {pendingExpandWord && (
              <div
                style={{ left: pendingExpandWord.x, top: pendingExpandWord.y + 46 }}
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
            )}
          </div>
        </div>
      </div>

      <p className="mt-2 text-center text-xs text-ink-muted">
        Chạm từ để nghe · <span className="font-semibold">i</span> xem thêm ·{" "}
        <span className="font-semibold">🌿</span> mở rộng nhánh · kéo nền để di chuyển
      </p>

      {ttsWarning && (
        <p className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          🔇 {ttsWarning}
          <button onClick={() => setTtsWarning(null)} className="font-semibold underline">
            Đóng
          </button>
        </p>
      )}

      {pendingFindNewRoot ? (
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
      )}
    </div>
  );
}
