import Link from "next/link";
import { getReviewStats } from "@/lib/progressStore";
import { getGrammarReviewStats } from "@/lib/grammarProgressStore";
import { buildHeatmapWeeks, buildUpcomingList, heatmapLevel, formatShortDateVn } from "@/lib/heatmap";

function mergeCounts(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const merged: Record<string, number> = { ...a };
  for (const [key, value] of Object.entries(b)) {
    merged[key] = (merged[key] ?? 0) + value;
  }
  return merged;
}

const LEVEL_CLASS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-surface-3",
  1: "bg-brand-200 dark:bg-brand-900",
  2: "bg-brand-400 dark:bg-brand-700",
  3: "bg-brand-600 dark:bg-brand-500",
  4: "bg-brand-800 dark:bg-brand-300",
};

const MONTH_VN = [
  "Th1", "Th2", "Th3", "Th4", "Th5", "Th6", "Th7", "Th8", "Th9", "Th10", "Th11", "Th12",
];

export default async function StatsPage() {
  const [vocabStats, grammarStats] = await Promise.all([getReviewStats(), getGrammarReviewStats()]);

  const stats = {
    history: mergeCounts(vocabStats.history, grammarStats.history),
    upcoming: mergeCounts(vocabStats.upcoming, grammarStats.upcoming),
    overdue: vocabStats.overdue + grammarStats.overdue,
    masteredCount: vocabStats.masteredCount + grammarStats.masteredCount,
    totalTracked: vocabStats.totalTracked + grammarStats.totalTracked,
  };
  const weeks = buildHeatmapWeeks(stats.history, 18);
  const upcoming = buildUpcomingList(stats.upcoming, 14);
  const maxUpcoming = Math.max(1, ...upcoming.map((d) => d.count));

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-3xl">
        <Link href="/" className="text-sm font-medium text-brand-600 hover:underline">
          ← Trang chủ
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">📊 Thống kê ôn tập</h1>
        <p className="mt-1 text-xs text-ink-muted">Gộp cả từ vựng và ngữ pháp.</p>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-border bg-surface-2 p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.overdue}</div>
            <div className="mt-0.5 text-xs text-ink-muted">Thẻ quá hạn</div>
            <div className="mt-1 text-[10px] text-ink-muted">
              Từ vựng {vocabStats.overdue} · Ngữ pháp {grammarStats.overdue}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-surface-2 p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {stats.masteredCount}
            </div>
            <div className="mt-0.5 text-xs text-ink-muted">Đã thuộc kỹ</div>
            <div className="mt-1 text-[10px] text-ink-muted">
              Từ vựng {vocabStats.masteredCount} · Ngữ pháp {grammarStats.masteredCount}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-surface-2 p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-ink">{stats.totalTracked}</div>
            <div className="mt-0.5 text-xs text-ink-muted">Tổng thẻ đã học</div>
            <div className="mt-1 text-[10px] text-ink-muted">
              Từ vựng {vocabStats.totalTracked} · Ngữ pháp {grammarStats.totalTracked}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-surface-2 p-4 shadow-sm">
          <h2 className="font-semibold text-ink">🔥 Hoạt động ôn tập (18 tuần gần nhất)</h2>
          <div className="mt-3 overflow-x-auto">
            <div className="inline-flex gap-1">
              {weeks.map((week, wi) => {
                const firstOfMonth = week.find((d) => d.count >= 0 && d.date.endsWith("-01"));
                return (
                  <div key={wi} className="flex flex-col gap-1">
                    <div className="h-3 text-center text-[9px] leading-3 text-ink-muted">
                      {firstOfMonth ? MONTH_VN[new Date(`${firstOfMonth.date}T00:00:00`).getMonth()] : ""}
                    </div>
                    {week.map((day) => (
                      <div
                        key={day.date}
                        title={day.count >= 0 ? `${formatShortDateVn(day.date)}: ${day.count} thẻ` : ""}
                        className={`h-3 w-3 rounded-sm ${
                          day.count < 0 ? "opacity-0" : LEVEL_CLASS[heatmapLevel(day.count)]
                        }`}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-ink-muted">
            <span>Ít</span>
            {([0, 1, 2, 3, 4] as const).map((lvl) => (
              <div key={lvl} className={`h-3 w-3 rounded-sm ${LEVEL_CLASS[lvl]}`} />
            ))}
            <span>Nhiều</span>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-surface-2 p-4 shadow-sm">
          <h2 className="font-semibold text-ink">📅 Sắp đến hạn (14 ngày tới)</h2>
          <div className="mt-3 flex flex-col gap-1.5">
            {upcoming.map((d) => (
              <div key={d.date} className="flex items-center gap-2 text-xs">
                <span className="w-16 shrink-0 text-ink-muted">{formatShortDateVn(d.date)}</span>
                <div className="h-4 flex-1 overflow-hidden rounded-full bg-surface-3">
                  {d.count > 0 && (
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-600 to-accent-500"
                      style={{ width: `${Math.max(6, (d.count / maxUpcoming) * 100)}%` }}
                    />
                  )}
                </div>
                <span className="w-8 shrink-0 text-right font-medium text-ink">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
