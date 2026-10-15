"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { OPEN_LOOKUP_EVENT, type OpenLookupDetail } from "@/components/lookup/types";

// Bảng tra chỉ tải khi mở lần đầu — header có mặt ở mọi trang, không để nó làm nặng trang nào
const QuickLookup = dynamic(() => import("@/components/lookup/QuickLookup"), { ssr: false });

const LANG_KEY = "lookup:lang";
type Lang = NonNullable<OpenLookupDetail["lang"]>;

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
}

/** Nút 🔍 Tra nhanh trên header + phím tắt "/" và Ctrl/⌘+K + sự kiện mở từ nơi khác (vd ô tra trang chủ). */
export default function QuickLookupHost() {
  const [open, setOpen] = useState<OpenLookupDetail | null>(null);

  const openWith = useCallback((detail: OpenLookupDetail = {}) => {
    let lang = detail.lang;
    if (!lang) {
      try {
        lang = (localStorage.getItem(LANG_KEY) as Lang | null) ?? undefined;
      } catch {
        // không đọc được → mặc định tiếng Trung
      }
    }
    setOpen({ query: detail.query ?? "", lang: lang ?? "zh" });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        openWith();
      } else if (e.key === "/" && !isTyping(e.target) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        openWith();
      }
    };
    const onOpen = (e: Event) => openWith((e as CustomEvent<OpenLookupDetail>).detail);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_LOOKUP_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_LOOKUP_EVENT, onOpen);
    };
  }, [openWith]);

  const close = useCallback(() => setOpen(null), []);

  return (
    <>
      <button
        onClick={() => openWith()}
        title="Tra nhanh từ vựng (phím / hoặc Ctrl K)"
        className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-white/30"
      >
        🔍<span className="hidden sm:inline">Tra nhanh</span>
      </button>
      {open && (
        <QuickLookup
          initialQuery={open.query}
          initialLang={open.lang}
          onClose={close}
        />
      )}
    </>
  );
}
