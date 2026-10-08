"use client";

import { useCallback, useEffect, useState } from "react";

export type CanvasBg =
  | "web"
  | "white"
  | "paper"
  | "paper-dark"
  | "grid"
  | "dots"
  | "mint"
  | "dark"
  | "night";

export interface MindmapSettings {
  /** Rê chuột lên ô bao lâu thì tự đọc. 0 = tắt. */
  hoverSpeakMs: number;
  bg: CanvasBg;
}

export const DEFAULT_SETTINGS: MindmapSettings = { hoverSpeakMs: 0, bg: "web" };

export const HOVER_DELAY_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Tắt" },
  { value: 500, label: "0,5 giây" },
  { value: 1000, label: "1 giây" },
  { value: 2000, label: "2 giây" },
];

/** Nền canvas.
 *
 * Dùng `backgroundColor` / `backgroundImage` / `backgroundSize` TÁCH RIÊNG, cố ý không dùng shorthand
 * `background`: trong shorthand, màu nền chỉ được phép nằm ở LỚP CUỐI CÙNG. Viết `"#fff linear-gradient(…)"`
 * là CSS không hợp lệ và trình duyệt vứt bỏ nguyên cả khai báo — nền lưới mất sạch mà không báo lỗi gì.
 *
 * `swatchSize` để ô xem trước 16px vẫn thấy được hoa văn (lưới 28px trong ô 16px thì không hiện vạch nào).
 */
export interface BgOption {
  id: CanvasBg;
  label: string;
  dark: boolean;
  style: React.CSSProperties;
  swatchSize?: string;
}

export const BG_OPTIONS: BgOption[] = [
  { id: "web", label: "Theo web", dark: false, style: {} },
  { id: "white", label: "Trắng", dark: false, style: { backgroundColor: "#ffffff" } },
  { id: "paper", label: "Giấy sách", dark: false, style: { backgroundColor: "#f6ecd9" } },
  { id: "paper-dark", label: "Giấy sách tối", dark: true, style: { backgroundColor: "#2b2520" } },
  {
    id: "grid",
    label: "Lưới",
    dark: false,
    swatchSize: "6px 6px",
    style: {
      backgroundColor: "#ffffff",
      backgroundImage:
        "linear-gradient(#e6e8ee 1px, transparent 1px), linear-gradient(90deg, #e6e8ee 1px, transparent 1px)",
      backgroundSize: "28px 28px",
    },
  },
  {
    id: "dots",
    label: "Chấm",
    dark: false,
    swatchSize: "6px 6px",
    style: {
      backgroundColor: "#ffffff",
      backgroundImage: "radial-gradient(#cfd4de 1.3px, transparent 1.3px)",
      backgroundSize: "20px 20px",
    },
  },
  { id: "mint", label: "Xanh dịu", dark: false, style: { backgroundColor: "#eef7f1" } },
  { id: "dark", label: "Tối", dark: true, style: { backgroundColor: "#1b1b1f" } },
  { id: "night", label: "Đêm xanh", dark: true, style: { backgroundColor: "#0f172a" } },
];

/** QUY ƯỚC MÀU CHỮ TRÊN NỀN ĐÃ CHỌN — áp dụng cho canvas và chế độ Tập trung.
 *
 * Nền ở đây CHỈ tô khoảng trống quanh các thẻ. Mọi chữ đều nằm trong một tấm thẻ có nền riêng
 * (`bg-green-100 dark:bg-green-950` ở `mindmapColors.ts`, `bg-brand-50` ở ô trung tâm, `bg-surface-2`
 * ở Tập trung) và những nền đó TỰ đảo theo theme sáng/tối — nên chữ cũng cứ để chạy theo theme.
 *
 * Đã thử ép màu chữ theo nền giấy và hỏng cả hai chiều, đo bằng tỉ lệ tương phản WCAG:
 *   · theme tối + nền "Giấy sách" → chữ #1f1d1a trên thẻ #241c38 = 1.04
 *   · theme sáng + nền "Đêm xanh" → chữ trắng/90 trên thẻ #f5f3ff = 1.09
 * Và nếu tô cả tấm thẻ theo màu giấy thì các nhãn bên trong (chip trình độ ở `levels.ts`) vẫn đảo
 * theo theme, cho ra "HSK5" sáng trên thẻ trắng = 1.25.
 *
 * Muốn giao diện giấy thật sự thì dùng "📄 Trang giấy" (`PaperSheetView`) — ở đó MỌI màu đều tự khai
 * báo cố định theo kiểu giấy, không đụng gì tới token theme.
 */
export const INK_FOLLOWS_THEME = true;

const KEY = "mindmap-settings-v1";

/** Cài đặt riêng của từng người xem, giữ trong localStorage của chính trình duyệt đó: đây là tiện
 * nghi cá nhân (nền nhìn cho dễ mắt, có đọc khi rê chuột hay không), không phải dữ liệu học tập cần
 * đồng bộ. Mọi truy cập đều bọc try/catch vì cửa sổ ẩn danh / chặn site data sẽ ném lỗi. */
export function useMindmapSettings() {
  const [settings, setSettings] = useState<MindmapSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<MindmapSettings>;
      setSettings({
        hoverSpeakMs:
          typeof parsed.hoverSpeakMs === "number" && HOVER_DELAY_OPTIONS.some((o) => o.value === parsed.hoverSpeakMs)
            ? parsed.hoverSpeakMs
            : DEFAULT_SETTINGS.hoverSpeakMs,
        bg: BG_OPTIONS.some((o) => o.id === parsed.bg) ? (parsed.bg as CanvasBg) : DEFAULT_SETTINGS.bg,
      });
    } catch {
      // không đọc được thì cứ dùng mặc định, không phải lỗi đáng báo cho người dùng
    }
  }, []);

  const update = useCallback((patch: Partial<MindmapSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // hết dung lượng / bị chặn: vẫn áp dụng cho phiên này, chỉ là không nhớ được sang lần sau
      }
      return next;
    });
  }, []);

  const bgOption = BG_OPTIONS.find((o) => o.id === settings.bg) ?? BG_OPTIONS[0];
  return { settings, update, bgOption };
}
