import Link from "next/link";
import { notFound } from "next/navigation";
import { getGrammarData, getTimeAxisPoints } from "@/lib/grammarStore";
import type { GrammarAspect, GrammarPoint, GrammarTimeSlot } from "@/types/grammar";

const TIME_ORDER: GrammarTimeSlot[] = [
  "qua-khu-xa",
  "qua-khu-gan",
  "hien-tai",
  "tuong-lai-gan",
  "tuong-lai-xa",
];
const TIME_LABEL: Record<GrammarTimeSlot, string> = {
  "qua-khu-xa": "Quá khứ xa",
  "qua-khu-gan": "Quá khứ gần",
  "hien-tai": "Hiện tại",
  "tuong-lai-gan": "Tương lai gần",
  "tuong-lai-xa": "Tương lai xa / dự định",
};

const ASPECT_ORDER: GrammarAspect[] = ["don-thuan", "tiep-dien", "hoan-thanh", "kinh-nghiem", "du-dinh"];
const ASPECT_LABEL: Record<GrammarAspect, string> = {
  "don-thuan": "Đơn thuần",
  "tiep-dien": "Tiếp diễn",
  "hoan-thanh": "Hoàn thành",
  "kinh-nghiem": "Kinh nghiệm",
  "du-dinh": "Dự định",
};

function Cell({ points }: { points: GrammarPoint[] }) {
  if (points.length === 0) {
    return <div className="flex min-h-[88px] items-center justify-center text-xs text-ink-muted/50">—</div>;
  }
  return (
    <div className="flex min-h-[88px] flex-col gap-1.5 p-1.5">
      {points.map((p) => (
        <div key={p.id} className="rounded-lg border border-border bg-surface-2 px-2 py-1.5">
          <div className="text-sm font-bold text-brand-600">{p.pattern}</div>
          <div className="text-xs text-ink-muted">{p.meaningVn}</div>
          {p.examples[0] && (
            <div className="mt-1 text-xs">
              <div className="text-ink">{p.examples[0].sentence}</div>
              <div className="text-ink-muted">{p.examples[0].translationVn}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default async function GrammarTimelinePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const data = getGrammarData(lang);
  if (!data) notFound();

  const points = getTimeAxisPoints(data);
  const grid = new Map<string, GrammarPoint[]>();
  for (const p of points) {
    if (!p.timeAxis) continue;
    const key = `${p.timeAxis.time}::${p.timeAxis.aspect}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key)!.push(p);
  }

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-6xl">
        <Link href={`/grammar/${lang}`} className="text-sm font-medium text-brand-600 hover:underline">
          ← {data.label}
        </Link>
        <div className="mt-2">
          <h1 className="text-2xl font-bold tracking-tight text-ink">🕐 Lưới thời gian (Trục B)</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {points.length} dạng chia — bố trí theo 2 chiều: <span className="font-semibold">thời gian</span>{" "}
            (cột) × <span className="font-semibold">thể</span> (hàng), giúp thấy pattern lặp lại giữa các
            dạng chia thay vì học vẹt từng cái riêng lẻ.
          </p>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[900px] border-separate border-spacing-1.5">
            <thead>
              <tr>
                <th className="w-28 text-left text-xs font-semibold text-ink-muted">Thể \ Thời gian</th>
                {TIME_ORDER.map((t) => (
                  <th
                    key={t}
                    className="rounded-xl bg-surface-3 px-2 py-2 text-center text-xs font-bold text-ink"
                  >
                    {TIME_LABEL[t]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ASPECT_ORDER.map((aspect) => (
                <tr key={aspect}>
                  <th className="rounded-xl bg-surface-3 px-2 py-2 text-left align-top text-xs font-bold text-ink">
                    {ASPECT_LABEL[aspect]}
                  </th>
                  {TIME_ORDER.map((time) => (
                    <td key={time} className="rounded-xl border border-border bg-surface align-top">
                      <Cell points={grid.get(`${time}::${aspect}`) ?? []} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
