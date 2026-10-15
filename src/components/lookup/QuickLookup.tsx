"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import LookupWordDetail from "@/components/lookup/LookupWordDetail";
import FamilyPanel from "@/components/lookup/FamilyPanel";
import type { LookupItem, OpenLookupDetail } from "@/components/lookup/types";

type Lang = NonNullable<OpenLookupDetail["lang"]>;

const LANGS: { id: Lang; label: string }[] = [
  { id: "zh", label: "🇨🇳 Trung" },
  { id: "ko", label: "🇰🇷 Hàn" },
];
const OTHER_LANGS: { id: Lang; label: string }[] = [
  { id: "ja", label: "🇯🇵 Nhật" },
  { id: "en", label: "🇬🇧 Anh" },
  { id: "es", label: "🇪🇸 TBN" },
];

/** Gợi ý cách tra cho người mới — mỗi chip là 1 kiểu tra khác nhau. */
const EXAMPLES: Record<Lang, { q: string; hint: string }[]> = {
  zh: [
    { q: "检查", hint: "chữ Hán" },
    { q: "jiancha", hint: "pinyin không dấu" },
    { q: "kiểm tra", hint: "nghĩa / Hán Việt" },
    { q: "mộc", hint: "âm Hán Việt 1 chữ" },
  ],
  ko: [
    { q: "학생", hint: "Hangul" },
    { q: "mokjae", hint: "romaja" },
    { q: "gỗ", hint: "nghĩa tiếng Việt" },
    { q: "học", hint: "âm Hán Việt" },
  ],
  ja: [{ q: "勉強", hint: "Kanji" }],
  en: [{ q: "biology", hint: "từ" }],
  es: [{ q: "hablar", hint: "từ" }],
};

const RECENT_KEY = "lookup:recent";
const MAX_RECENT = 8;

function readRecent(): { q: string; lang: Lang }[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

/** Ghi vào lịch sử tra trên server (nguồn cho "Ôn từ đã tra") — lỗi mạng thì bỏ qua. */
function recordLookup(lang: Lang, headword: string) {
  fetch("/api/lookup/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lang, headword }),
  }).catch(() => {});
}

function pushRecent(q: string, lang: Lang) {
  try {
    const next = [{ q, lang }, ...readRecent().filter((r) => !(r.q === q && r.lang === lang))].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // chế độ riêng tư — bỏ qua lịch sử
  }
}

/** Bảng Tra nhanh (mở từ nút 🔍 trên header, phím "/" hoặc Ctrl/⌘+K). Toàn màn hình trên điện thoại. */
export default function QuickLookup({
  initialQuery = "",
  initialLang = "zh",
  onClose,
}: {
  initialQuery?: string;
  initialLang?: Lang;
  onClose: () => void;
}) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<LookupItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [recent, setRecent] = useState<{ q: string; lang: Lang }[]>([]);
  /** Đang xem "họ chữ" của chữ này (thay cho danh sách kết quả). */
  const [familyChar, setFamilyChar] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRecent(readRecent());
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  useEffect(() => {
    try {
      localStorage.setItem("lookup:lang", lang);
    } catch {
      // không lưu được thì lần sau mặc định tiếng Trung
    }
  }, [lang]);

  // Chữ viết của từ khoá đã nói rõ ngôn ngữ: Hangul → Hàn, Kana → Nhật. Chữ Hán thì để nguyên (ở tab Hàn,
  // tra theo Hanja cũng hữu ích) — chỉ gợi ý nút sang tiếng Trung bên dưới.
  useEffect(() => {
    if (/[\uac00-\ud7a3\u1100-\u11ff\u3130-\u318f]/.test(query) && lang !== "ko") setLang("ko");
    else if (/[\u3040-\u30ff]/.test(query) && lang !== "ja") setLang("ja");
  }, [query, lang]);

  // Tra ngay khi gõ (trễ 200ms), huỷ request cũ để kết quả không nhảy lộn xộn
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setTotal(0);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/lookup?lang=${lang}&limit=20&q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Không tra được.");
        setResults(data.results);
        setTotal(data.total);
        setError(null);
        // Khớp đúng chữ thì mở luôn chi tiết — đỡ một lần bấm
        const exact = data.results[0] && data.results[0].headword === q ? data.results[0] : null;
        setOpenId(exact?.id ?? null);
        if (exact) recordLookup(lang, exact.headword);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, lang]);

  function openItem(item: LookupItem) {
    const nextOpen = openId === item.id ? null : item.id;
    setOpenId(nextOpen);
    if (nextOpen) {
      recordLookup(lang, item.headword);
      pushRecent(item.headword, lang);
      setRecent(readRecent());
    }
  }

  function updateItem(next: LookupItem) {
    setResults((rs) => rs.map((r) => (r.id === next.id ? next : r)));
  }

  const q = query.trim();
  const tab = (active: boolean) =>
    `whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
      active ? "bg-brand-600 text-white" : "border border-border bg-surface text-ink-muted hover:text-ink"
    }`;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 backdrop-blur-sm sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Tra nhanh từ vựng"
    >
      <div className="flex h-dvh w-full max-w-2xl flex-col overflow-hidden bg-surface shadow-2xl sm:h-auto sm:max-h-[88vh] sm:rounded-3xl">
        <div className="border-b border-border p-3 sm:p-4" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">🔍</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setFamilyChar(null);
                }}
                placeholder="Chữ, pinyin/romaja, Hán Việt hoặc nghĩa…"
                className="w-full rounded-xl border border-border bg-surface-2 py-2.5 pl-9 pr-8 text-base text-ink placeholder:text-ink-muted/70 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              {query && (
                <button
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  aria-label="Xoá"
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-1 text-ink-muted hover:text-ink"
                >
                  ✕
                </button>
              )}
            </div>
            <button onClick={onClose} className="shrink-0 rounded-lg px-2 py-2 text-sm font-semibold text-ink-muted hover:text-ink">
              Đóng
            </button>
          </div>
          <div className="mt-2 flex items-center gap-1.5 overflow-x-auto">
            {LANGS.map((l) => (
              <button key={l.id} onClick={() => setLang(l.id)} className={tab(lang === l.id)}>
                {l.label}
              </button>
            ))}
            <select
              value={OTHER_LANGS.some((l) => l.id === lang) ? lang : ""}
              onChange={(e) => e.target.value && setLang(e.target.value as Lang)}
              className={`${tab(OTHER_LANGS.some((l) => l.id === lang))} appearance-none`}
              aria-label="Ngôn ngữ khác"
            >
              <option value="">Khác…</option>
              {OTHER_LANGS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
            {q && !loading && <span className="ml-auto shrink-0 text-[11px] text-ink-muted">{total} kết quả</span>}
          </div>
          {lang !== "zh" && /\p{Script=Han}/u.test(q) && !/[\uac00-\ud7a3\u3040-\u30ff]/.test(q) && (
            <button
              onClick={() => setLang("zh")}
              className="mt-2 rounded-full border border-brand-600/40 bg-brand-600/10 px-3 py-1 text-xs font-semibold text-brand-600"
            >
              🇨🇳 Tra &ldquo;{q}&rdquo; trong tiếng Trung →
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          {familyChar && (
            <FamilyPanel
              char={familyChar}
              onBack={() => setFamilyChar(null)}
              onOpenWord={(l, headword) => {
                setFamilyChar(null);
                setLang(l);
                setQuery(headword);
              }}
            />
          )}

          {!familyChar && !q && (
            <div className="flex flex-col gap-4">
              {recent.length > 0 && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Tra gần đây</span>
                    <Link href="/on-tu-da-tra" onClick={onClose} className="text-xs font-semibold text-brand-600 hover:underline">
                      🃏 Ôn các từ đã tra →
                    </Link>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recent.map((r) => (
                      <button
                        key={`${r.lang}-${r.q}`}
                        onClick={() => {
                          setLang(r.lang);
                          setQuery(r.q);
                        }}
                        className="rounded-full border border-border bg-surface-2 px-3 py-1 text-sm text-ink hover:bg-surface-3"
                      >
                        {r.q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Thử tra theo nhiều cách</div>
                <div className="flex flex-wrap gap-1.5">
                  {EXAMPLES[lang].map((ex) => (
                    <button
                      key={ex.q}
                      onClick={() => setQuery(ex.q)}
                      className="rounded-xl border border-border bg-surface-2 px-3 py-1.5 text-left hover:bg-surface-3"
                    >
                      <div className="text-sm text-ink">{ex.q}</div>
                      <div className="text-[10px] text-ink-muted">{ex.hint}</div>
                    </button>
                  ))}
                </div>
              </div>
              <p className="hidden text-[11px] text-ink-muted sm:block">
                Mẹo: bấm <kbd className="rounded border border-border px-1">/</kbd> hoặc{" "}
                <kbd className="rounded border border-border px-1">Ctrl K</kbd> ở bất kỳ trang nào để mở bảng tra.
              </p>
            </div>
          )}

          {!familyChar && q && loading && results.length === 0 && <p className="py-6 text-center text-sm text-ink-muted">Đang tra…</p>}
          {!familyChar && error && <p className="py-4 text-center text-sm text-red-600">{error}</p>}

          {!familyChar && q && !loading && !error && results.length === 0 && (
            <div className="py-6 text-center">
              <p className="text-sm text-ink-muted">Chưa có &ldquo;{q}&rdquo; trong kho từ.</p>
              <Link
                href={`/my-vocab?ai=${encodeURIComponent(q)}&lang=${lang}`}
                onClick={onClose}
                className="mt-3 inline-block rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-md"
              >
                ✨ Tra bằng AI và lưu vào từ của tôi
              </Link>
            </div>
          )}

          {!familyChar && results.length > 0 && (
            <ul className="flex flex-col gap-2">
              {results.map((r) => (
                <li key={r.id}>
                  {openId === r.id ? (
                    <div>
                      <button onClick={() => setOpenId(null)} className="mb-1 text-[11px] font-semibold text-ink-muted hover:text-ink">
                        ▲ Thu gọn
                      </button>
                      <LookupWordDetail item={r} onChange={updateItem} onNavigate={onClose} onOpenFamily={setFamilyChar} />
                    </div>
                  ) : (
                    <button
                      onClick={() => openItem(r)}
                      className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface-2 px-3 py-2 text-left hover:border-brand-600/40 hover:bg-surface-3"
                    >
                      <span className="shrink-0 text-xl font-semibold text-ink">{r.headword}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs text-ink-muted">
                          {r.reading}
                          {r.hanViet && !r.hanViet.partial && r.hanViet.parts.every((p) => p.native || p.hv)
                            ? ` · ${r.hanViet.parts.map((p) => (p.native ? p.char : p.hv)).join(" ")}`
                            : ""}
                        </span>
                        <span className="block truncate text-sm text-ink">{r.meaningVn}</span>
                      </span>
                      {r.bookmarked && <span className="shrink-0 text-xs text-emerald-600" title="Đã thêm vào ôn tập">★</span>}
                      {r.level && <span className="shrink-0 rounded-full bg-surface-3 px-1.5 py-0.5 text-[9px] font-bold text-ink-muted">{r.level}</span>}
                    </button>
                  )}
                </li>
              ))}
              {total > results.length && (
                <li className="py-1 text-center text-[11px] text-ink-muted">
                  Hiện {results.length}/{total} — gõ cụ thể hơn để thu hẹp.
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
