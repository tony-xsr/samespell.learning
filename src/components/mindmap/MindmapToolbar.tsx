"use client";

import MindmapSettingsMenu from "@/components/mindmap/MindmapSettingsMenu";
import type { MindmapSettings } from "@/lib/mindmapSettings";

/** Thanh công cụ dùng chung cho cả mindmap nhóm âm/hình (`MindmapCanvas`) và mindmap chủ đề
 * (`TopicMindmapCanvas`).
 *
 * Trước đây hai file có hai khối JSX giống nhau từng chữ — thêm một nút là phải sửa hai nơi, và đã có
 * tiền lệ các màn học bị lệch nhau vì kiểu này. Gom vào một component vừa hết lệch, vừa gọn hơn về
 * thị giác: các nút biểu tượng được xếp thành từng CỤM liền khối (một viền chung, có vạch chia) thay
 * vì 8 vòng tròn rời rạc trôi nổi — ít đường viền cạnh tranh nhau hơn, dễ quét mắt hơn.
 */

const PILL = "flex h-9 items-center gap-1 rounded-full border px-3 text-xs font-semibold transition";
const PILL_IDLE = "border-border bg-surface-2 text-ink hover:border-brand-300 hover:bg-surface-3";
const SEG = "flex h-9 items-center rounded-full border border-border bg-surface-2 overflow-hidden";
const SEG_BTN = "flex h-9 w-9 items-center justify-center text-sm text-ink transition hover:bg-surface-3";
const DIVIDER = "h-5 w-px shrink-0 bg-border";

export default function MindmapToolbar({
  hideMeaning,
  onToggleHideMeaning,
  onFocusMode,
  onPaperMode,
  onWordList,
  onMatchGame,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetView,
  orientationVertical,
  onToggleOrientation,
  isFullscreen,
  onToggleFullscreen,
  settings,
  onChangeSettings,
}: {
  hideMeaning: boolean;
  onToggleHideMeaning: () => void;
  onFocusMode: () => void;
  onPaperMode: () => void;
  onWordList: () => void;
  onMatchGame: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  orientationVertical: boolean;
  onToggleOrientation: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  settings: MindmapSettings;
  onChangeSettings: (patch: Partial<MindmapSettings>) => void;
}) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5">
      {/* Cụm HỌC — những thứ người học bấm nhiều nhất, nên nằm bên trái và có nhãn chữ. */}
      {/* Các nút này đã có chữ hiện sẵn nên KHÔNG gắn aria-label: aria-label sẽ GHI ĐÈ tên mà trình
          đọc màn hình / điều khiển bằng giọng nói đọc ra, khiến người dùng đọc thấy "Tập trung" nhưng
          phải gọi một cái tên khác mới bấm được. Chú thích dài để ở `title`. */}
      <button
        type="button"
        onClick={onFocusMode}
        title="Học từng nhánh một, phủ kín màn hình, bỏ hết nút phụ"
        className={`${PILL} border-brand-400 bg-brand-600 text-white hover:brightness-110`}
      >
        🎯 Tập trung
      </button>
      <button
        type="button"
        onClick={onPaperMode}
        title="Đổ cả mindmap xuống một trang giấy để đọc hoặc in"
        className={`${PILL} ${PILL_IDLE}`}
      >
        📄 Trang giấy
      </button>
      <button
        type="button"
        onClick={onWordList}
        title="Bảng tra cứu có ô lọc và lọc theo trình độ"
        className={`${PILL} ${PILL_IDLE}`}
      >
        ☰ Danh sách
      </button>
      <button
        type="button"
        onClick={onMatchGame}
        title="Trò ghép từ với nghĩa"
        className={`${PILL} ${PILL_IDLE}`}
      >
        🎮 Ghép nghĩa
      </button>
      <button
        type="button"
        onClick={onToggleHideMeaning}
        aria-pressed={hideMeaning}
        title={hideMeaning ? "Hiện lại nghĩa tiếng Việt" : "Ẩn nghĩa tiếng Việt để tự kiểm tra"}
        className={`${PILL} ${
          hideMeaning
            ? "border-amber-400 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
            : PILL_IDLE
        }`}
      >
        {hideMeaning ? "👁 Hiện nghĩa" : "🙈 Ẩn nghĩa"}
      </button>

      {/* Cụm ĐIỀU KHIỂN CANVAS — đẩy sang phải, gom liền khối cho đỡ rối. */}
      <div className="ml-auto flex items-center gap-1.5">
        <div className={SEG}>
          <button type="button" onClick={onZoomOut} aria-label="Thu nhỏ" className={SEG_BTN}>
            −
          </button>
          <span className="w-11 text-center text-xs tabular-nums text-ink-muted">
            {Math.round(zoom * 100)}%
          </span>
          <button type="button" onClick={onZoomIn} aria-label="Phóng to" className={SEG_BTN}>
            +
          </button>
        </div>

        <div className={SEG}>
          <button type="button" onClick={onResetView} aria-label="Về giữa" className={SEG_BTN}>
            ⟲
          </button>
          <span aria-hidden className={DIVIDER} />
          <button
            type="button"
            onClick={onToggleOrientation}
            aria-label={orientationVertical ? "Chuyển sang layout ngang" : "Chuyển sang layout dọc"}
            title={
              orientationVertical
                ? "Layout dọc (bấm để chuyển sang ngang)"
                : "Layout ngang (bấm để chuyển sang dọc)"
            }
            className={SEG_BTN}
          >
            {orientationVertical ? "↔" : "↕"}
          </button>
          <span aria-hidden className={DIVIDER} />
          <button
            type="button"
            onClick={onToggleFullscreen}
            aria-label={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
            className={SEG_BTN}
          >
            {isFullscreen ? "⤢" : "⛶"}
          </button>
        </div>

        <MindmapSettingsMenu
          settings={settings}
          onChange={onChangeSettings}
          onResetLayout={onResetView}
          onBookMode={onToggleFullscreen}
          bookModeActive={isFullscreen}
        />
      </div>
    </div>
  );
}
