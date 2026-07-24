"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { THEMES, THEME_LABELS, THEME_SWATCH, FONT_SIZES, FONT_SIZE_LABELS } from "@/lib/theme";

export default function ThemeSwitcher() {
  const { theme, mode, fontSize, setTheme, toggleMode, setFontSize } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Đổi giao diện"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-2 text-sm shadow-sm hover:border-border-strong"
      >
        <span
          className="h-5 w-5 rounded-full ring-1 ring-black/10"
          style={{ background: THEME_SWATCH[theme] }}
        />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-border bg-surface-2 p-3 shadow-lg">
          <p className="text-xs font-medium text-ink-muted">Giao diện</p>
          <div className="mt-2 flex gap-2">
            {THEMES.map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition ${
                  theme === t ? "border-ink" : "border-transparent"
                }`}
                aria-label={THEME_LABELS[t]}
                title={THEME_LABELS[t]}
              >
                <span className="h-6 w-6 rounded-full" style={{ background: THEME_SWATCH[t] }} />
              </button>
            ))}
          </div>

          <button
            onClick={toggleMode}
            className="mt-3 flex w-full items-center justify-between rounded-lg bg-surface-3 px-3 py-2 text-sm hover:bg-border"
          >
            <span>{mode === "dark" ? "Chế độ tối" : "Chế độ sáng"}</span>
            <span>{mode === "dark" ? "🌙" : "☀️"}</span>
          </button>

          <p className="mt-3 text-xs font-medium text-ink-muted">Cỡ chữ</p>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            {FONT_SIZES.map((size) => (
              <button
                key={size}
                onClick={() => setFontSize(size)}
                className={`rounded-lg border-2 px-2 py-1.5 text-xs font-medium transition ${
                  fontSize === size
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-border bg-surface-3 text-ink-muted hover:border-border-strong"
                }`}
                aria-label={FONT_SIZE_LABELS[size]}
              >
                <span
                  className={size === "small" ? "text-xs" : size === "large" ? "text-base" : "text-sm"}
                >
                  A
                </span>
                <div className="mt-0.5">{FONT_SIZE_LABELS[size]}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
