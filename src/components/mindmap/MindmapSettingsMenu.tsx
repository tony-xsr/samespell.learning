"use client";

import { useEffect, useRef, useState } from "react";
import {
  BG_OPTIONS,
  HOVER_DELAY_OPTIONS,
  type MindmapSettings,
} from "@/lib/mindmapSettings";

export default function MindmapSettingsMenu({
  settings,
  onChange,
  onResetLayout,
  onBookMode,
  bookModeActive,
}: {
  settings: MindmapSettings;
  onChange: (patch: Partial<MindmapSettings>) => void;
  onResetLayout: () => void;
  onBookMode: () => void;
  bookModeActive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Tuỳ chỉnh mindmap"
        className={`flex h-9 items-center gap-1 rounded-full border px-3 text-xs font-semibold transition ${
          open
            ? "border-brand-400 bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
            : "border-border bg-surface-2 text-ink hover:border-brand-300 hover:bg-surface-3"
        }`}
      >
        ⚙ Tuỳ chỉnh ▾
      </button>

      {open && (
        <div
          role="group"
          aria-label="Bảng tuỳ chỉnh mindmap"
          className="absolute right-0 z-40 mt-1 w-64 rounded-2xl border border-border bg-surface p-3 text-left shadow-xl"
        >
          <label className="flex items-center justify-between gap-2 text-xs text-ink">
            <span>🔊 Rê chuột để nghe</span>
            <select
              value={settings.hoverSpeakMs}
              onChange={(e) => onChange({ hoverSpeakMs: Number(e.target.value) })}
              aria-label="Độ trễ rê chuột để nghe"
              className="rounded-lg border border-border bg-surface-2 px-2 py-1 text-xs text-ink focus:border-brand-400 focus:outline-none"
            >
              {HOVER_DELAY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-ink-muted">Nền</p>
          <div className="mt-1.5 grid grid-cols-2 gap-1">
            {BG_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => onChange({ bg: o.id })}
                aria-pressed={settings.bg === o.id}
                aria-label={`Nền ${o.label}`}
                className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-xs transition ${
                  settings.bg === o.id
                    ? "border-brand-500 bg-brand-50 font-semibold text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
                    : "border-transparent text-ink hover:bg-surface-3"
                }`}
              >
                <span
                  aria-hidden
                  style={o.swatchSize ? { ...o.style, backgroundSize: o.swatchSize } : o.style}
                  className="h-4 w-4 shrink-0 rounded border border-border bg-surface-3"
                />
                <span className="truncate">{o.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-3 border-t border-border pt-2">
            <button
              type="button"
              onClick={() => {
                onResetLayout();
                setOpen(false);
              }}
              className="w-full rounded-lg px-2 py-1.5 text-left text-xs text-ink hover:bg-surface-3"
            >
              ↺ Về bố cục gốc
            </button>
            <button
              type="button"
              onClick={() => {
                onBookMode();
                setOpen(false);
              }}
              aria-pressed={bookModeActive}
              className="w-full rounded-lg px-2 py-1.5 text-left text-xs text-ink hover:bg-surface-3"
            >
              📖 Chế độ trang sách {bookModeActive ? "(đang bật)" : "(toàn màn hình)"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
