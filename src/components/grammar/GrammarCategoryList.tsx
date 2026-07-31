"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { GrammarCategory, GrammarLevel, GrammarPoint } from "@/types/grammar";
import type { Language } from "@/types/vocab";
import StoryNodeSentence from "@/components/grammar/StoryNodeSentence";

const LEVEL_LABEL: Record<GrammarLevel, string> = {
  "so-cap": "Sơ cấp",
  "trung-cap": "Trung cấp",
  "cao-cap": "Cao cấp",
};
const LEVEL_ORDER: GrammarLevel[] = ["so-cap", "trung-cap", "cao-cap"];
const LEVEL_BADGE: Record<GrammarLevel, string> = {
  "so-cap": "bg-emerald-100 text-emerald-700",
  "trung-cap": "bg-amber-100 text-amber-700",
  "cao-cap": "bg-rose-100 text-rose-700",
};
const LEVEL_BADGE_OFF = "bg-surface-3 text-ink-muted";

function groupByLevel(points: GrammarPoint[]): [GrammarLevel, GrammarPoint[]][] {
  const map = new Map<GrammarLevel, GrammarPoint[]>();
  for (const p of points) {
    if (!map.has(p.level)) map.set(p.level, []);
    map.get(p.level)!.push(p);
  }
  return LEVEL_ORDER.filter((l) => map.has(l)).map((l) => [l, map.get(l)!]);
}

function PointCard({ point, lang }: { point: GrammarPoint; lang: string }) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-surface-2 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="text-lg font-bold text-brand-600">{point.pattern}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${LEVEL_BADGE[point.level]}`}>
          {LEVEL_LABEL[point.level]}
        </span>
      </div>
      <p className="mt-1 text-sm font-medium text-ink">{point.meaningVn}</p>
      <p className="mt-1 text-xs text-ink-muted">
        <span className="font-semibold">Cách chia:</span> {point.formationRule}
      </p>
      {point.register && (
        <p className="mt-0.5 text-xs text-ink-muted">
          <span className="font-semibold">Văn phong:</span> {point.register}
        </p>
      )}
      <p className="mt-2 rounded-xl bg-surface-3 p-2.5 text-xs text-ink">{point.nuanceVn}</p>

      {point.examples.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5">
          {point.examples.map((ex, i) => (
            <div key={i} className="rounded-lg bg-surface px-2.5 py-1.5 text-xs">
              <StoryNodeSentence sentence={ex.sentence} lang={lang as Language} className="font-medium text-ink" />
              <div className="text-ink-muted">{ex.translationVn}</div>
              {ex.note && <div className="mt-0.5 italic text-accent-600">{ex.note}</div>}
            </div>
          ))}
        </div>
      )}

      {point.commonMistakeVn && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
          <span className="font-semibold">⚠️ Lỗi hay gặp:</span> {point.commonMistakeVn}
        </p>
      )}
      <p className="mt-2 text-xs text-brand-600">
        <span className="font-semibold">💡 Mẹo nhớ:</span> {point.mnemonicVn}
      </p>

      {point.confusionGroupId && (
        <Link
          href={`/grammar/${lang}/confusion#${point.confusionGroupId}`}
          className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-accent-500/10 px-2.5 py-1 text-xs font-medium text-accent-600 hover:bg-accent-500/20"
        >
          ⚡ Xem cụm dễ nhầm liên quan
        </Link>
      )}
    </div>
  );
}

export default function GrammarCategoryList({
  categories,
  lang,
}: {
  categories: GrammarCategory[];
  lang: string;
}) {
  const [activeLevels, setActiveLevels] = useState<Set<GrammarLevel>>(new Set(LEVEL_ORDER));

  function toggleLevel(level: GrammarLevel) {
    setActiveLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
        if (next.size === 1) return next; // luôn giữ ít nhất 1 trình độ được chọn
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  }

  const filteredCategories = useMemo(
    () =>
      categories
        .map((cat) => ({
          ...cat,
          points: cat.points.filter((p) => activeLevels.has(p.level)),
        }))
        .filter((cat) => cat.points.length > 0),
    [categories, activeLevels],
  );

  const visibleCount = filteredCategories.reduce((sum, c) => sum + c.points.length, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-border bg-surface-2 px-4 py-3">
        <span className="text-sm font-semibold text-ink">Lọc theo trình độ:</span>
        {LEVEL_ORDER.map((level) => {
          const active = activeLevels.has(level);
          return (
            <button
              key={level}
              type="button"
              onClick={() => toggleLevel(level)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                active ? LEVEL_BADGE[level] : LEVEL_BADGE_OFF
              }`}
              aria-pressed={active}
            >
              {LEVEL_LABEL[level]}
            </button>
          );
        })}
        <span className="ml-auto text-xs text-ink-muted">{visibleCount} điểm đang hiện</span>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {filteredCategories.map((cat) => (
          <details key={cat.id} open className="group rounded-2xl border border-border">
            <summary className="cursor-pointer list-none">
              <div className="flex items-center gap-2 rounded-2xl bg-surface-2 px-4 py-3 hover:bg-surface-3">
                <span className="text-base font-bold text-ink">{cat.titleVn}</span>
                <span className="text-sm font-medium text-ink-muted">{cat.points.length} điểm</span>
                <span className="ml-auto text-ink-muted transition-transform group-open:rotate-90">▶</span>
              </div>
            </summary>
            <div className="flex flex-col gap-4 p-4">
              {groupByLevel(cat.points).map(([level, points]) => (
                <div key={level}>
                  <h3 className="mb-2 text-sm font-semibold text-ink-muted">{LEVEL_LABEL[level]}</h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {points.map((p) => (
                      <PointCard key={p.id} point={p} lang={lang} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        ))}
        {filteredCategories.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-ink-muted">
            Không có điểm ngữ pháp nào ở (các) trình độ đã chọn.
          </p>
        )}
      </div>
    </div>
  );
}
