"use client";

import type { ReactNode } from "react";
import type { SrsRating } from "@/types/vocab";
import { RATING_LABELS } from "@/lib/srs";
import type { ClusterBrowserApi } from "@/lib/useClusterBrowser";

/** Nút tròn dùng chung cho thanh công cụ toàn màn hình (zoom, điều hướng, thoát...). */
export function ToolButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-border bg-surface-2 text-sm text-ink hover:border-amber-300 hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-40"
      aria-label={label}
    >
      {children}
    </button>
  );
}

/** Cụm nút chấm điểm SRS + đánh dấu đã thuộc + yêu thích — khoá theo `itemId` (chain.id / pair.id /
 * cluster.id) trong cùng kho tiến trình `/api/progress` vốn tổng quát theo `wordId` bất kỳ chuỗi nào. */
function ProgressControls({
  itemId,
  isBookmarked,
  isMastered,
  isRating,
  onToggleBookmark,
  onToggleMastered,
  onRate,
}: {
  itemId: string;
  isBookmarked: boolean;
  isMastered: boolean;
  isRating: boolean;
  onToggleBookmark: () => void;
  onToggleMastered: () => void;
  onRate: (rating: SrsRating) => void;
}) {
  return (
    <div className="mt-4 rounded-xl border border-border bg-surface-3/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-ink-muted">Mức độ nhớ</span>
        <button
          type="button"
          onClick={onToggleBookmark}
          className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
            isBookmarked
              ? "border-amber-400 bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
              : "border-border bg-surface-2 text-ink-muted hover:border-amber-300"
          }`}
          aria-label={isBookmarked ? "Bỏ đánh dấu yêu thích" : "Đánh dấu yêu thích"}
        >
          {isBookmarked ? "★ Yêu thích" : "☆ Yêu thích"}
        </button>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {([0, 1, 2, 3] as SrsRating[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => onRate(r)}
            disabled={isRating}
            className={`rounded-full px-2 py-2 text-xs font-semibold text-white shadow-sm transition disabled:opacity-50 ${
              [
                "bg-red-500 hover:bg-red-600",
                "bg-orange-500 hover:bg-orange-600",
                "bg-blue-500 hover:bg-blue-600",
                "bg-green-500 hover:bg-green-600",
              ][r]
            }`}
          >
            {RATING_LABELS[r]}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onToggleMastered}
        className="mt-2 w-full text-center text-xs font-medium text-green-600 underline decoration-dotted hover:text-green-700"
      >
        {isMastered ? "↩️ Bỏ đánh dấu đã thuộc" : "✅ Đã thuộc kỹ rồi — bỏ qua trong ôn tập"}
      </button>
      <span className="sr-only">{itemId}</span>
    </div>
  );
}

/** Khung toàn màn hình dùng chung: container LUÔN được mount (ẩn bằng "invisible" khi chưa mở gì) —
 * nếu chỉ render lúc mở thì `containerRef.current` sẽ là `null` đúng lúc `enterFullscreen()` chạy, khiến
 * Fullscreen API thật không bao giờ được gọi ở lần mở đầu (đã xác nhận thực nghiệm trong `ChainBrowser`).
 * Bên trong: thanh điều hướng ‹/› + phóng to + thoát, thanh tự động đọc, khe `children` cho panel chi
 * tiết, và cụm nút tiến trình ở chân. */
export default function ClusterBrowserShell({
  ui,
  headerBadge,
  idLabel,
  children,
}: {
  ui: ClusterBrowserApi;
  /** Nhãn phụ bên phải thanh điều hướng (vd "12 mắt xích" cho chuỗi nối đuôi). */
  headerBadge?: ReactNode;
  /** Chuỗi id hiển thị mờ ở góc trái thanh điều hướng — mặc định là `ui.currentId`. */
  idLabel?: string;
  /** Panel chi tiết — người gọi tự `key` theo id để remount khi đổi phần tử. */
  children: ReactNode;
}) {
  const {
    containerRef,
    fullscreenClassName,
    openIndex,
    currentId,
    count,
    currentWordCount,
    zoom,
    setZoom,
    close,
    step,
    autoPlaying,
    autoPlayWordIndex,
    repeatCount,
    setRepeatCount,
    autoMarkHard,
    setAutoMarkHard,
    toggleAutoPlay,
    bookmarkedIds,
    masteredIds,
    ratingId,
    handleToggleBookmark,
    handleToggleMastered,
    handleRate,
  } = ui;

  const active = openIndex !== null && !!currentId;

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-40 flex h-full flex-col overflow-hidden bg-surface ${
        active ? "visible" : "invisible pointer-events-none"
      } ${fullscreenClassName}`}
    >
      {active && currentId && (
        <>
          <div className="flex items-center justify-between gap-2 border-b border-border px-6 py-3 sm:px-10">
            <div className="flex min-w-0 items-center gap-2">
              <ToolButton onClick={() => step(-1)} disabled={openIndex === 0} label="Phần trước">
                ‹
              </ToolButton>
              <span className="whitespace-nowrap text-xs text-ink-muted">
                {openIndex + 1} / {count}
              </span>
              <ToolButton onClick={() => step(1)} disabled={openIndex === count - 1} label="Phần sau">
                ›
              </ToolButton>
              <span className="ml-2 truncate font-mono text-xs text-ink-muted">{idLabel ?? currentId}</span>
            </div>
            <div className="flex flex-none items-center gap-1">
              {headerBadge && (
                <span className="mr-1 rounded-md bg-surface-3 px-2 py-0.5 text-[11px] font-bold text-ink-muted">
                  {headerBadge}
                </span>
              )}
              <ToolButton onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))} label="Thu nhỏ">
                −
              </ToolButton>
              <span className="w-11 text-center text-xs text-ink-muted">{Math.round(zoom * 100)}%</span>
              <ToolButton onClick={() => setZoom((z) => Math.min(1.8, +(z + 0.1).toFixed(2)))} label="Phóng to">
                +
              </ToolButton>
              <ToolButton onClick={() => setZoom(1)} label="Về cỡ gốc">
                ⟲
              </ToolButton>
              <ToolButton onClick={close} label="Thoát toàn màn hình">
                ⤢
              </ToolButton>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-3/40 px-6 py-2 sm:px-10">
            <button
              type="button"
              onClick={toggleAutoPlay}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
                autoPlaying
                  ? "border-red-400 bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                  : "border-brand-400 bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-950/30 dark:text-brand-300"
              }`}
            >
              {autoPlaying ? "⏸ Dừng đọc" : "▶️ Tự động đọc"}
            </button>
            <div className="flex items-center gap-1.5 text-xs text-ink-muted">
              <span>Lặp từ gốc:</span>
              <ToolButton
                onClick={() => setRepeatCount((c) => Math.max(1, c - 1))}
                disabled={autoPlaying}
                label="Giảm số lần lặp"
              >
                −
              </ToolButton>
              <span className="w-4 text-center font-semibold text-ink">{repeatCount}</span>
              <ToolButton
                onClick={() => setRepeatCount((c) => Math.min(6, c + 1))}
                disabled={autoPlaying}
                label="Tăng số lần lặp"
              >
                +
              </ToolButton>
            </div>
            <button
              type="button"
              onClick={() => setAutoMarkHard((v) => !v)}
              disabled={autoPlaying}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                autoMarkHard
                  ? "border-orange-400 bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"
                  : "border-border bg-surface-2 text-ink-muted hover:border-orange-300"
              }`}
              aria-pressed={autoMarkHard}
              title="Khi đọc xong 1 phần tử, tự động gắn mức độ nhớ 'Khó' cho phần tử đó (chỉ nghe thụ động nên mặc định coi là chưa nhớ chắc)"
            >
              {autoMarkHard ? "☑" : "☐"} Tự động đánh dấu Khó khi nghe
            </button>
            {autoPlaying && autoPlayWordIndex !== null && (
              <span className="text-xs text-ink-muted">
                Đang đọc {autoPlayWordIndex + 1}/{currentWordCount}…
              </span>
            )}
          </div>

          <div className="flex flex-1 flex-col overflow-hidden">{children}</div>

          <div className="border-t border-border px-6 py-3 sm:px-10">
            <div className="mx-auto max-w-2xl">
              <ProgressControls
                itemId={currentId}
                isBookmarked={bookmarkedIds.has(currentId)}
                isMastered={masteredIds.has(currentId)}
                isRating={ratingId === currentId}
                onToggleBookmark={() => handleToggleBookmark(currentId)}
                onToggleMastered={() => handleToggleMastered(currentId)}
                onRate={(r) => handleRate(currentId, r)}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
