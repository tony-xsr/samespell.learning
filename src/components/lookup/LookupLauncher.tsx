"use client";

import Link from "next/link";
import { OPEN_LOOKUP_EVENT, type OpenLookupDetail } from "@/components/lookup/types";

/** Ô "tra nhanh" to trên trang chủ — thực chất là nút mở bảng Tra nhanh (QuickLookupHost trên header). */
export default function LookupLauncher() {
  const open = (detail: OpenLookupDetail = {}) =>
    window.dispatchEvent(new CustomEvent<OpenLookupDetail>(OPEN_LOOKUP_EVENT, { detail }));

  return (
    <div className="rounded-2xl border border-border bg-surface-2 p-3 shadow-sm">
      <button
        onClick={() => open()}
        className="flex w-full items-center gap-2 rounded-xl border border-border bg-surface px-3 py-3 text-left text-sm text-ink-muted transition hover:border-brand-400"
      >
        <span>🔍</span>
        <span className="min-w-0 flex-1 truncate">Tra nhanh Trung · Hàn — chữ, pinyin, Hán Việt, nghĩa…</span>
        <kbd className="hidden rounded border border-border px-1.5 text-[10px] sm:inline">/</kbd>
      </button>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {[
          { query: "kiểm tra", lang: "zh" as const, label: "🇨🇳 kiểm tra" },
          { query: "jiancha", lang: "zh" as const, label: "🇨🇳 jiancha" },
          { query: "học", lang: "ko" as const, label: "🇰🇷 học (Hán Việt)" },
          { query: "gỗ", lang: "ko" as const, label: "🇰🇷 gỗ" },
        ].map((ex) => (
          <button
            key={ex.label}
            onClick={() => open({ query: ex.query, lang: ex.lang })}
            className="rounded-full bg-surface-3 px-2.5 py-1 text-[11px] text-ink-muted hover:text-ink"
          >
            {ex.label}
          </button>
        ))}
        <Link href="/on-tu-da-tra" className="ml-auto text-[11px] font-semibold text-brand-600 hover:underline">
          🃏 Ôn từ đã tra →
        </Link>
      </div>
    </div>
  );
}
