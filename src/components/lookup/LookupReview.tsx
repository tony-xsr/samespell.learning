"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { speak } from "@/lib/tts";
import type { LookupResult } from "@/lib/lookupIndex";
import { OPEN_LOOKUP_EVENT } from "@/components/lookup/types";

type Item = LookupResult & { lookedUpAt: number };
type LangFilter = "all" | "zh" | "ko";

const RATINGS = [
  { rating: 0, label: "😕 Quên", key: "1", className: "border-red-400 text-red-600 dark:text-red-400" },
  { rating: 2, label: "🙂 Nhớ", key: "2", className: "border-emerald-500 text-emerald-700 dark:text-emerald-400" },
  { rating: 3, label: "😎 Dễ", key: "3", className: "border-sky-500 text-sky-700 dark:text-sky-400" },
] as const;

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Ôn nhanh các từ vừa tra: nhìn + nghe → (gợi ý Hán Việt) → lật xem nghĩa, tách Hán Việt, mẹo nhớ → tự chấm.
 * Điểm ghi thẳng vào tiến độ ôn tập (SRS), nên từ đã tra sẽ quay lại đúng lúc ở phần Ôn tập chung. */
export default function LookupReview() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<LangFilter>("all");
  const [deck, setDeck] = useState<Item[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [hint, setHint] = useState(false);
  const [forgotten, setForgotten] = useState<Item[]>([]);
  const [remembered, setRemembered] = useState(0);

  useEffect(() => {
    fetch("/api/lookup/history")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Không tải được lịch sử tra.");
        setItems(data.items);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Có lỗi xảy ra"));
  }, []);

  const filtered = useMemo(
    () => (items ?? []).filter((it) => filter === "all" || it.language === filter),
    [items, filter],
  );

  const start = useCallback((cards: Item[]) => {
    setDeck(shuffle(cards));
    setIndex(0);
    setFlipped(false);
    setHint(false);
    setForgotten([]);
    setRemembered(0);
  }, []);

  useEffect(() => {
    start(filtered);
  }, [filtered, start]);

  const card = deck[index];
  const finished = deck.length > 0 && index >= deck.length;

  useEffect(() => {
    if (card) speak(card.headword, card.language);
  }, [card]);

  const rate = useCallback(
    (rating: number) => {
      if (!card) return;
      fetch("/api/progress/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordId: card.id, rating }),
      }).catch(() => {});
      if (rating === 0) setForgotten((f) => [...f, card]);
      else setRemembered((n) => n + 1);
      setFlipped(false);
      setHint(false);
      setIndex((i) => i + 1);
    },
    [card],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (!card) return;
      if (e.key === " ") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped) {
        const r = RATINGS.find((x) => x.key === e.key);
        if (r) rate(r.rating);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, flipped, rate]);

  const counts = useMemo(() => {
    const all = items ?? [];
    return { all: all.length, zh: all.filter((i) => i.language === "zh").length, ko: all.filter((i) => i.language === "ko").length };
  }, [items]);

  const openLookup = () => window.dispatchEvent(new CustomEvent(OPEN_LOOKUP_EVENT, { detail: {} }));
  const chip = (active: boolean) =>
    `whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
      active ? "bg-brand-600 text-white" : "border border-border bg-surface text-ink-muted hover:text-ink"
    }`;

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-6 sm:py-8">
      <div className="w-full max-w-md">
        <Link href="/" className="text-sm font-medium text-brand-600 hover:underline">
          ← Trang chủ
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">🃏 Ôn từ đã tra</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Nhìn + nghe → nhớ nghĩa (bí thì xem gợi ý Hán Việt) → lật thẻ → tự chấm. Điểm được ghi vào ôn tập SRS.
        </p>

        {error && <p className="mt-6 text-center text-sm text-red-600">{error}</p>}
        {!items && !error && <p className="mt-6 text-center text-sm text-ink-muted">Đang tải…</p>}

        {items && items.length === 0 && (
          <div className="mt-6 rounded-2xl border border-border bg-surface-2 p-5 text-center">
            <p className="text-sm text-ink-muted">Chưa tra từ nào. Tra vài từ rồi quay lại đây ôn nhé.</p>
            <button
              onClick={openLookup}
              className="mt-3 rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-4 py-2 text-sm font-semibold text-white"
            >
              🔍 Mở Tra nhanh
            </button>
          </div>
        )}

        {items && items.length > 0 && (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <button onClick={() => setFilter("all")} className={chip(filter === "all")}>
                Tất cả ({counts.all})
              </button>
              {counts.zh > 0 && (
                <button onClick={() => setFilter("zh")} className={chip(filter === "zh")}>
                  🇨🇳 Trung ({counts.zh})
                </button>
              )}
              {counts.ko > 0 && (
                <button onClick={() => setFilter("ko")} className={chip(filter === "ko")}>
                  🇰🇷 Hàn ({counts.ko})
                </button>
              )}
              {!finished && deck.length > 0 && (
                <span className="ml-auto text-xs text-ink-muted">
                  {Math.min(index + 1, deck.length)}/{deck.length}
                </span>
              )}
            </div>

            {card && (
              <div className="mt-4">
                <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${(index / deck.length) * 100}%` }} />
                </div>
                <div className="rounded-3xl border border-border bg-surface-2 p-6 text-center shadow-md">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-4xl font-bold text-ink">{card.headword}</span>
                    <button
                      onClick={() => speak(card.headword, card.language)}
                      aria-label="Nghe lại"
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-3 text-sm"
                    >
                      🔊
                    </button>
                  </div>

                  {!flipped && card.hanViet && (
                    <div className="mt-3">
                      {hint ? (
                        <HanVietChips item={card} />
                      ) : (
                        <button
                          onClick={() => setHint(true)}
                          className="rounded-full border border-amber-400 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300"
                        >
                          💡 Gợi ý Hán Việt
                        </button>
                      )}
                    </div>
                  )}

                  {flipped ? (
                    <div className="mt-4 border-t border-border pt-4 text-left">
                      <div className="text-sm text-ink-muted">{card.reading}</div>
                      <div className="mt-1 text-lg font-semibold text-brand-600">{card.meaningVn}</div>
                      {card.hanViet && (
                        <div className="mt-2">
                          <HanVietChips item={card} />
                        </div>
                      )}
                      {card.mnemonicVn && (
                        <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                          💡 {card.mnemonicVn}
                        </div>
                      )}
                      {card.example && (
                        <div className="mt-3 text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-ink">{card.example}</span>
                            <button
                              onClick={() => speak(card.example, card.language)}
                              aria-label="Đọc ví dụ"
                              className="shrink-0 text-xs"
                            >
                              🔊
                            </button>
                          </div>
                          <div className="mt-0.5 text-xs italic text-ink-muted">{card.exampleVn}</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => setFlipped(true)}
                      className="mt-5 w-full rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md"
                    >
                      Lật thẻ <span className="hidden opacity-70 sm:inline">(Space)</span>
                    </button>
                  )}
                </div>

                {flipped && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {RATINGS.map((r) => (
                      <button
                        key={r.rating}
                        onClick={() => rate(r.rating)}
                        className={`rounded-2xl border-2 bg-surface px-2 py-2.5 text-sm font-semibold ${r.className}`}
                      >
                        {r.label}
                        <span className="ml-1 hidden text-[10px] opacity-60 sm:inline">{r.key}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {finished && (
              <div className="mt-6 rounded-3xl border border-border bg-surface-2 p-6 text-center">
                <div className="text-4xl">{forgotten.length === 0 ? "🎉" : "💪"}</div>
                <p className="mt-2 text-lg font-semibold text-ink">
                  Nhớ {remembered}/{deck.length} từ
                </p>
                {forgotten.length > 0 && (
                  <p className="mt-1 text-sm text-ink-muted">
                    Còn quên: {forgotten.map((f) => f.headword).join(", ")}
                  </p>
                )}
                <div className="mt-4 flex flex-col gap-2">
                  {forgotten.length > 0 && (
                    <button
                      onClick={() => start(forgotten)}
                      className="rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      🔁 Ôn lại {forgotten.length} từ còn quên
                    </button>
                  )}
                  <button onClick={() => start(filtered)} className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-ink">
                    Ôn lại từ đầu
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function HanVietChips({ item }: { item: LookupResult }) {
  const hv = item.hanViet;
  if (!hv) return null;
  return (
    <div className="flex flex-wrap items-end justify-center gap-1.5">
      {hv.parts.map((p, i) => (
        <span key={i} className="flex min-w-11 flex-col items-center rounded-lg bg-surface-3 px-2 py-1">
          {p.syllable && <span className="text-[10px] text-ink-muted">{p.syllable}</span>}
          <span className="text-lg leading-tight text-ink">{p.char}</span>
          <span className={`text-[11px] font-semibold ${p.native ? "text-ink-muted" : "text-brand-600"}`}>
            {p.native ? "thuần Hàn" : p.hv ?? "—"}
          </span>
        </span>
      ))}
    </div>
  );
}
