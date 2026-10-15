"use client";

import { useEffect, useState } from "react";
import type { FamilyResult, LookupResult } from "@/lib/lookupIndex";

/** "Họ chữ" của 1 chữ Hán: mọi từ Trung chứa chữ đó + mọi từ Hàn có Hanja chứa chữ đó. Học 1 chữ (学 học)
 * là đoán được nghĩa cả họ từ ở hai ngôn ngữ — cách nhớ hiệu quả nhất với người Việt. */
export default function FamilyPanel({
  char,
  onBack,
  onOpenWord,
}: {
  char: string;
  onBack: () => void;
  onOpenWord: (lang: "zh" | "ko", headword: string) => void;
}) {
  const [data, setData] = useState<FamilyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    fetch(`/api/lookup/family?char=${encodeURIComponent(char)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Không tra được họ chữ.");
        if (!cancelled) setData(json);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Có lỗi xảy ra"));
    return () => {
      cancelled = true;
    };
  }, [char]);

  return (
    <div>
      <button onClick={onBack} className="mb-2 text-[11px] font-semibold text-ink-muted hover:text-ink">
        ← Quay lại
      </button>
      {error && <p className="py-4 text-center text-sm text-red-600">{error}</p>}
      {!data && !error && <p className="py-6 text-center text-sm text-ink-muted">Đang gom họ chữ…</p>}
      {data && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4 rounded-2xl border border-brand-600/30 bg-surface-2 p-4">
            <div className="text-5xl leading-none text-ink">{data.char}</div>
            <div className="min-w-0">
              {data.hanViet && <div className="text-xl font-bold uppercase tracking-wide text-brand-600">{data.hanViet}</div>}
              {data.meaningVn && <div className="text-sm text-ink">{data.meaningVn}</div>}
              {data.forms.length > 1 && (
                <div className="mt-0.5 text-[11px] text-ink-muted">Giản / phồn thể: {data.forms.join(" · ")}</div>
              )}
            </div>
          </div>
          <p className="text-[11px] text-ink-muted">
            Nhớ chữ <b>{data.char}</b>{data.hanViet ? ` = ${data.hanViet}` : ""} là đoán được nghĩa cả họ từ dưới đây — bấm 1 từ để
            xem chi tiết.
          </p>
          <FamilyList
            title="🇨🇳 Tiếng Trung"
            items={data.zh}
            total={data.zhTotal}
            highlight={data.forms}
            onOpen={(w) => onOpenWord("zh", w.headword)}
          />
          <FamilyList
            title="🇰🇷 Tiếng Hàn"
            items={data.ko}
            total={data.koTotal}
            highlight={data.forms}
            onOpen={(w) => onOpenWord("ko", w.headword)}
            emptyNote="Chưa có từ tiếng Hàn nào (đã xác định Hanja) chứa chữ này."
          />
        </div>
      )}
    </div>
  );
}

function FamilyList({
  title,
  items,
  total,
  highlight,
  onOpen,
  emptyNote = "Chưa có từ nào.",
}: {
  title: string;
  items: LookupResult[];
  total: number;
  highlight: string[];
  onOpen: (w: LookupResult) => void;
  emptyNote?: string;
}) {
  return (
    <section>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
        {title} ({total})
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-ink-muted">{emptyNote}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {items.map((w) => {
            const parts = w.hanViet?.parts ?? [];
            return (
              <li key={w.id}>
                <button
                  onClick={() => onOpen(w)}
                  className="flex w-full items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2 text-left hover:border-brand-600/40 hover:bg-surface-3"
                >
                  <span className="shrink-0 text-lg text-ink">{w.headword}</span>
                  <span className="min-w-0 flex-1">
                    {parts.length > 0 && (
                      <span className="block truncate text-[11px] text-ink-muted">
                        {parts.map((p, i) => (
                          <span key={i} className={!p.native && highlight.includes(p.char) ? "font-bold text-brand-600" : undefined}>
                            {i > 0 ? " " : ""}
                            {p.native ? p.char : `${p.char}${p.hv ? ` ${p.hv}` : ""}`}
                          </span>
                        ))}
                      </span>
                    )}
                    <span className="block truncate text-xs text-ink">{w.meaningVn}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {total > items.length && <p className="mt-1 text-[11px] text-ink-muted">+{total - items.length} từ khác</p>}
    </section>
  );
}
