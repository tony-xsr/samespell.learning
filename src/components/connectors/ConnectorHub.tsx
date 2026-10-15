"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ConnectorCategoryId, ConnectorLanguage, ConnectorLanguageData } from "@/types/connector";
import ConnectorCard from "@/components/connectors/ConnectorCard";
import ConnectorPractice from "@/components/connectors/ConnectorPractice";
import { chipClass, flatten, LANG_LABEL, type FlatEntry, type LangView } from "@/components/connectors/shared";

type Tab = "learn" | "practice";

function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").normalize("NFC").toLowerCase();
}

function matches(e: FlatEntry, q: string): boolean {
  if (!q) return true;
  const f = fold(q);
  return (
    e.form.toLowerCase().includes(q.toLowerCase()) ||
    fold(e.reading).replace(/\s/g, "").includes(f.replace(/\s/g, "")) ||
    fold(e.meaningVn).includes(f) ||
    (!!e.hanViet && fold(e.hanViet).includes(f))
  );
}

/** Mục 🔗 Từ nối: liên từ, trạng từ nối câu, đuôi nối (và / hoặc / nhưng / vì vậy / ví dụ…) của tiếng Trung
 * và tiếng Hàn, xếp theo chức năng tiếng Việt. Xem từng ngôn ngữ, hoặc song song Trung–Hàn cùng chức năng;
 * cụm dễ nhầm ở cuối; tab Luyện tập: điền từ nối vào câu, chọn nghĩa, thẻ nhớ ghi vào SRS. */
export default function ConnectorHub({
  data,
  initialLang,
  initialId,
  initialTab,
}: {
  data: Record<ConnectorLanguage, ConnectorLanguageData>;
  initialLang: LangView;
  initialId?: string;
  initialTab: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [lang, setLang] = useState<LangView>(initialLang);
  const [category, setCategory] = useState<ConnectorCategoryId | "all" | "confusion">("all");
  const [query, setQuery] = useState("");
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(initialId ? [initialId] : []));

  const flat = useMemo(() => ({ zh: flatten(data.zh), ko: flatten(data.ko) }), [data]);
  const byId = useMemo(() => new Map([...flat.zh, ...flat.ko].map((e) => [e.id, e])), [flat]);
  const categories = data.zh.categories;

  useEffect(() => {
    if (!initialId) return;
    const t = setTimeout(() => document.getElementById(`c-${initialId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
    return () => clearTimeout(t);
  }, [initialId]);

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const jumpTo = (id: string) => {
    const e = byId.get(id);
    if (!e) return;
    setCategory("all");
    setQuery("");
    if (lang !== "both" && lang !== e.language) setLang(e.language);
    setOpenIds((prev) => new Set(prev).add(id));
    setTimeout(() => document.getElementById(`c-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  };

  const langs: ConnectorLanguage[] = lang === "both" ? ["zh", "ko"] : [lang];
  const visibleCats = categories.filter((c) => category === "all" || category === c.id);
  const filteredFor = (l: ConnectorLanguage, catId: ConnectorCategoryId) =>
    flat[l].filter((e) => e.categoryId === catId && matches(e, query.trim()));

  const practicePool = useMemo(
    () =>
      langs.flatMap((l) => flat[l]).filter((e) => category === "all" || category === "confusion" || e.categoryId === category),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang, category, flat],
  );
  const confusions = langs.flatMap((l) => data[l].confusions.map((c) => ({ ...c, language: l })));

  const total = flat.zh.length + flat.ko.length;

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-6 sm:py-8">
      <div className="w-full max-w-4xl min-w-0">
        <Link href="/" className="text-sm font-medium text-brand-600 hover:underline">
          ← Trang chủ
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">🔗 Từ nối Trung – Hàn</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {total} liên từ, trạng từ nối câu, đuôi nối hay dùng — và, hoặc, nhưng, vì vậy, ví dụ, tức là… xếp theo chức năng tiếng
          Việt, kèm Hán Việt, ví dụ, mẹo nhớ và các cặp dễ nhầm.
        </p>

        <div className="mt-4 flex gap-2">
          {(
            [
              ["learn", "📚 Học"],
              ["practice", "🏋️ Luyện tập"],
            ] as const
          ).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                tab === t ? "bg-gradient-to-r from-brand-600 to-accent-500 text-white" : "border border-border bg-surface text-ink-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {(["zh", "ko", "both"] as const).map((l) => (
            <button key={l} onClick={() => setLang(l)} className={chipClass(lang === l)}>
              {l === "both" ? "⇆ Song song Trung–Hàn" : LANG_LABEL[l]}
            </button>
          ))}
        </div>

        <div className="-mx-4 mt-3 overflow-x-auto px-4 pb-1">
          <div className="flex w-max gap-2">
            <button onClick={() => setCategory("all")} className={chipClass(category === "all")}>
              Tất cả
            </button>
            {categories.map((c) => (
              <button key={c.id} onClick={() => setCategory(c.id)} className={chipClass(category === c.id)} title={c.titleVn}>
                {c.icon} {c.titleVn.split(" — ")[0]}
              </button>
            ))}
            {tab === "learn" && (
              <button onClick={() => setCategory("confusion")} className={chipClass(category === "confusion")}>
                ⚠️ Dễ nhầm
              </button>
            )}
          </div>
        </div>

        {tab === "practice" ? (
          <ConnectorPractice
            key={`${lang}-${category}`}
            pool={practicePool}
            confusions={confusions}
            byId={byId}
          />
        ) : (
          <>
            {category !== "confusion" && (
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Lọc: vì vậy, hoac, 但是, geuraeseo…"
                className="mt-3 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-500"
              />
            )}

            {category !== "confusion" &&
              visibleCats.map((cat) => {
                const cols = langs.map((l) => ({ l, entries: filteredFor(l, cat.id) }));
                if (cols.every((c) => c.entries.length === 0)) return null;
                return (
                  <section key={cat.id} className="mt-6">
                    <h2 className="text-sm font-bold text-ink">
                      {cat.icon} {cat.titleVn}
                    </h2>
                    <div className={`mt-2 grid gap-3 ${lang === "both" ? "grid-cols-2" : "sm:grid-cols-2"}`}>
                      {lang === "both"
                        ? cols.map(({ l, entries }) => (
                            <div key={l} className="flex min-w-0 flex-col gap-2">
                              <div className="text-xs font-semibold text-ink-muted">{LANG_LABEL[l]}</div>
                              {entries.map((e) => (
                                <ConnectorCard key={e.id} entry={e} open={openIds.has(e.id)} onToggle={() => toggle(e.id)} compact />
                              ))}
                            </div>
                          ))
                        : cols[0].entries.map((e) => (
                            <ConnectorCard key={e.id} entry={e} open={openIds.has(e.id)} onToggle={() => toggle(e.id)} />
                          ))}
                    </div>
                  </section>
                );
              })}

            {(category === "all" || category === "confusion") && !query && (
              <section className="mt-8">
                <h2 className="text-sm font-bold text-ink">⚠️ Cụm dễ nhầm — phân biệt cho chắc</h2>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {confusions.map((cf) => (
                    <div key={cf.id} className="rounded-2xl border border-amber-400/60 bg-amber-500/5 p-3">
                      <div className="text-sm font-bold text-ink">
                        {lang === "both" && <span className="mr-1">{cf.language === "zh" ? "🇨🇳" : "🇰🇷"}</span>}
                        {cf.titleVn}
                      </div>
                      <p className="mt-1 text-sm text-ink-muted">{cf.explanationVn}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {cf.entryIds.map((id) => {
                          const e = byId.get(id);
                          return e ? (
                            <button
                              key={id}
                              onClick={() => jumpTo(id)}
                              className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-ink hover:border-brand-400"
                            >
                              {e.form}
                            </button>
                          ) : null;
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
