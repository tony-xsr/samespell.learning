"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import type { GrammarCategory, GrammarLevel, GrammarPoint } from "@/types/grammar";
import type { Language, ProgressStore, SrsRating, WordProgress } from "@/types/vocab";
import { loadGrammarProgress } from "@/lib/grammarProgress";
import { RATING_LABELS } from "@/lib/srs";
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
const OFF_BADGE = "bg-surface-3 text-ink-muted";

type ReviewStatus = "unreviewed" | "reviewed";
const REVIEW_STATUS_ORDER: ReviewStatus[] = ["unreviewed", "reviewed"];
const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  unreviewed: "🆕 Chưa ôn",
  reviewed: "👁 Đã ôn",
};
const REVIEW_STATUS_BADGE: Record<ReviewStatus, string> = {
  unreviewed: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  reviewed: "bg-sky-100 text-sky-700",
};

const DIFFICULTY_ORDER: SrsRating[] = [0, 1, 2, 3];
const DIFFICULTY_BADGE: Record<SrsRating, string> = {
  0: "bg-red-100 text-red-700",
  1: "bg-orange-100 text-orange-700",
  2: "bg-blue-100 text-blue-700",
  3: "bg-green-100 text-green-700",
};

function groupByLevel(points: GrammarPoint[]): [GrammarLevel, GrammarPoint[]][] {
  const map = new Map<GrammarLevel, GrammarPoint[]>();
  for (const p of points) {
    if (!map.has(p.level)) map.set(p.level, []);
    map.get(p.level)!.push(p);
  }
  return LEVEL_ORDER.filter((l) => map.has(l)).map((l) => [l, map.get(l)!]);
}

function PointCard({
  point,
  lang,
  prog,
  expanded,
  onToggleExpand,
}: {
  point: GrammarPoint;
  lang: string;
  prog: WordProgress | undefined;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const reviewed = (prog?.reviewCount ?? 0) > 0;

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-surface-2 shadow-sm">
      <div
        role="button"
        tabIndex={0}
        onClick={onToggleExpand}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onToggleExpand();
        }}
        className="flex cursor-pointer flex-col gap-2 p-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <span className="text-lg font-bold text-brand-600">{point.pattern}</span>
          <span className="ml-auto shrink-0 text-ink-muted transition-transform" style={{ transform: expanded ? "rotate(90deg)" : undefined }}>
            ▶
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${LEVEL_BADGE[point.level]}`}>
            {LEVEL_LABEL[point.level]}
          </span>
          {prog?.mastered && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              ✅ Đã thuộc
            </span>
          )}
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${REVIEW_STATUS_BADGE[reviewed ? "reviewed" : "unreviewed"]}`}>
            {REVIEW_STATUS_LABEL[reviewed ? "reviewed" : "unreviewed"]}
          </span>
          {prog?.lastRating !== undefined && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${DIFFICULTY_BADGE[prog.lastRating]}`}>
              {RATING_LABELS[prog.lastRating]}
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-ink">{point.meaningVn}</p>
      </div>

      {expanded && (
        <div className="flex flex-col gap-2 border-t border-border p-4 pt-3" onClick={(e) => e.stopPropagation()}>
          <p className="text-xs text-ink-muted">
            <span className="font-semibold">Cách chia:</span> {point.formationRule}
          </p>
          {point.register && (
            <p className="text-xs text-ink-muted">
              <span className="font-semibold">Văn phong:</span> {point.register}
            </p>
          )}
          <p className="rounded-xl bg-surface-3 p-2.5 text-xs text-ink">{point.nuanceVn}</p>

          {point.examples.length > 0 && (
            <div className="flex flex-col gap-1.5">
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
            <p className="text-xs text-red-600 dark:text-red-400">
              <span className="font-semibold">⚠️ Lỗi hay gặp:</span> {point.commonMistakeVn}
            </p>
          )}
          <p className="text-xs text-brand-600">
            <span className="font-semibold">💡 Mẹo nhớ:</span> {point.mnemonicVn}
          </p>

          {point.confusionGroupId && (
            <Link
              href={`/grammar/${lang}/confusion#${point.confusionGroupId}`}
              className="inline-flex w-fit items-center gap-1 rounded-full bg-accent-500/10 px-2.5 py-1 text-xs font-medium text-accent-600 hover:bg-accent-500/20"
            >
              ⚡ Xem cụm dễ nhầm liên quan
            </Link>
          )}
        </div>
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
  const [activeReviewStatus, setActiveReviewStatus] = useState<Set<ReviewStatus>>(new Set(REVIEW_STATUS_ORDER));
  const [activeDifficulty, setActiveDifficulty] = useState<Set<SrsRating>>(new Set(DIFFICULTY_ORDER));
  const [progress, setProgress] = useState<ProgressStore>({});
  // Mặc định THU GỌN mọi thẻ — danh sách quá dài (có nhóm tới 68 điểm), mỗi thẻ đầy đủ ví dụ/sắc thái/
  // mẹo nhớ chiếm nhiều chỗ, chỉ nên hiện đầy đủ khi thực sự bấm vào xem.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    loadGrammarProgress().then((p) => {
      if (!cancelled) setProgress(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleInSet<T>(setter: Dispatch<SetStateAction<Set<T>>>, value: T) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        if (next.size === 1) return next; // luôn giữ ít nhất 1 lựa chọn được chọn ở mỗi hàng lọc
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  }

  function toggleExpand(pointId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(pointId)) next.delete(pointId);
      else next.add(pointId);
      return next;
    });
  }

  function pointPasses(p: GrammarPoint): boolean {
    if (!activeLevels.has(p.level)) return false;
    const prog = progress[p.id];
    const reviewed: ReviewStatus = (prog?.reviewCount ?? 0) > 0 ? "reviewed" : "unreviewed";
    if (!activeReviewStatus.has(reviewed)) return false;
    // Điểm CHƯA từng chấm điểm không có "độ khó" để so — luôn cho qua bộ lọc độ khó, để hàng lọc
    // "Tiến trình" (chưa ôn/đã ôn) mới là nơi quyết định có ẩn nó hay không, tránh 2 hàng lọc chồng
    // chéo nhau gây khó hiểu (vd bỏ chọn "Khó" không nên vô tình ẩn luôn mọi thẻ chưa ôn).
    if (prog?.lastRating !== undefined && !activeDifficulty.has(prog.lastRating)) return false;
    return true;
  }

  const filteredCategories = useMemo(
    () =>
      categories
        .map((cat) => ({
          ...cat,
          points: cat.points.filter(pointPasses),
        }))
        .filter((cat) => cat.points.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories, activeLevels, activeReviewStatus, activeDifficulty, progress],
  );

  const visibleCount = filteredCategories.reduce((sum, c) => sum + c.points.length, 0);
  const visiblePointIds = useMemo(() => filteredCategories.flatMap((c) => c.points.map((p) => p.id)), [filteredCategories]);

  return (
    <div>
      <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-border bg-surface-2 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 shrink-0 text-sm font-semibold text-ink">Trình độ:</span>
          {LEVEL_ORDER.map((level) => {
            const active = activeLevels.has(level);
            return (
              <button
                key={level}
                type="button"
                onClick={() => toggleInSet(setActiveLevels, level)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${active ? LEVEL_BADGE[level] : OFF_BADGE}`}
                aria-pressed={active}
              >
                {LEVEL_LABEL[level]}
              </button>
            );
          })}
          <span className="ml-auto text-xs text-ink-muted">{visibleCount} điểm đang hiện</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 shrink-0 text-sm font-semibold text-ink">Tiến trình:</span>
          {REVIEW_STATUS_ORDER.map((status) => {
            const active = activeReviewStatus.has(status);
            return (
              <button
                key={status}
                type="button"
                onClick={() => toggleInSet(setActiveReviewStatus, status)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${active ? REVIEW_STATUS_BADGE[status] : OFF_BADGE}`}
                aria-pressed={active}
              >
                {REVIEW_STATUS_LABEL[status]}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 shrink-0 text-sm font-semibold text-ink">Độ khó:</span>
          {DIFFICULTY_ORDER.map((rating) => {
            const active = activeDifficulty.has(rating);
            return (
              <button
                key={rating}
                type="button"
                onClick={() => toggleInSet(setActiveDifficulty, rating)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${active ? DIFFICULTY_BADGE[rating] : OFF_BADGE}`}
                aria-pressed={active}
              >
                {RATING_LABELS[rating]}
              </button>
            );
          })}
          <span className="text-[11px] text-ink-muted">(thẻ chưa ôn luôn hiện — dùng hàng &ldquo;Tiến trình&rdquo; để ẩn)</span>
        </div>
        <div className="flex items-center gap-3 border-t border-dashed border-border pt-2">
          <button
            type="button"
            onClick={() => setExpandedIds(new Set(visiblePointIds))}
            className="text-xs font-medium text-brand-600 underline decoration-dotted hover:text-brand-700"
          >
            Mở rộng tất cả
          </button>
          <button
            type="button"
            onClick={() => setExpandedIds(new Set())}
            className="text-xs font-medium text-ink-muted underline decoration-dotted hover:text-ink"
          >
            Thu gọn tất cả
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {filteredCategories.map((cat) => (
          <details key={cat.id} open className="group rounded-2xl border border-border">
            <summary className="cursor-pointer list-none">
              <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface-2 px-4 py-3 hover:bg-surface-3">
                <span className="text-base font-bold text-ink">{cat.titleVn}</span>
                <span className="text-sm font-medium text-ink-muted">{cat.points.length} điểm</span>
                {/* Luyện riêng NHÓM NÀY thay vì toàn bộ — stopPropagation để bấm link không làm
                    <details> đóng/mở theo (click vẫn "chạm" tới <summary> nên phải chặn nổi bọt). */}
                <Link
                  href={`/grammar/${lang}/review?category=${cat.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:brightness-105"
                >
                  🗂️ Luyện tập
                </Link>
                <Link
                  href={`/grammar/${lang}/test?category=${cat.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-full bg-gradient-to-r from-sky-600 to-sky-400 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:brightness-105"
                >
                  🧪 Trắc nghiệm
                </Link>
                <span className="ml-auto text-ink-muted transition-transform group-open:rotate-90">▶</span>
              </div>
            </summary>
            <div className="flex flex-col gap-4 p-4">
              {groupByLevel(cat.points).map(([level, points]) => (
                <div key={level}>
                  <h3 className="mb-2 text-sm font-semibold text-ink-muted">{LEVEL_LABEL[level]}</h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {points.map((p) => (
                      <PointCard
                        key={p.id}
                        point={p}
                        lang={lang}
                        prog={progress[p.id]}
                        expanded={expandedIds.has(p.id)}
                        onToggleExpand={() => toggleExpand(p.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        ))}
        {filteredCategories.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-ink-muted">
            Không có điểm ngữ pháp nào khớp bộ lọc đã chọn.
          </p>
        )}
      </div>
    </div>
  );
}
