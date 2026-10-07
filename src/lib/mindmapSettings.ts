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
export const BG_OPTIONS: {
  id: CanvasBg;
  label: string;
  dark: boolean;
  style: React.CSSProperties;
  swatchSize?: string;
}[] = [
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
