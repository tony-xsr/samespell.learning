import Link from "next/link";
import { notFound } from "next/navigation";
import { getGrammarData, getGrammarPoint } from "@/lib/grammarStore";

export default async function GrammarConfusionPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const data = getGrammarData(lang);
  if (!data) notFound();

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-4xl">
        <Link href={`/grammar/${lang}`} className="text-sm font-medium text-brand-600 hover:underline">
          ← {data.label}
        </Link>
        <div className="mt-2">
          <h1 className="text-2xl font-bold tracking-tight text-ink">⚡ Cụm ngữ pháp dễ nhầm</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {data.confusionGroups.length} cụm — các cấu trúc GIỐNG NHAU về hình thức/ngữ cảnh nhưng khác
            nhau về sắc thái, dễ dùng lẫn nhất.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-6">
          {data.confusionGroups.map((group) => {
            const points = group.pointIds
              .map((id) => getGrammarPoint(data, id))
              .filter((p): p is NonNullable<typeof p> => !!p);
            return (
              <div
                key={group.id}
                id={group.id}
                className="scroll-mt-4 rounded-2xl border-2 border-dashed border-accent-400 p-4"
              >
                <h2 className="text-lg font-bold text-ink">{group.titleVn}</h2>
                <p className="mt-1 rounded-xl bg-accent-500/10 p-3 text-sm text-ink">{group.summaryVn}</p>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {points.map((p) => (
                    <div key={p.id} className="rounded-xl border border-border bg-surface-2 p-3">
                      <span className="text-base font-bold text-brand-600">{p.pattern}</span>
                      <p className="mt-0.5 text-sm font-medium text-ink">{p.meaningVn}</p>
                      <p className="mt-1.5 text-xs text-ink">{p.nuanceVn}</p>
                      {p.examples.length > 0 && (
                        <div className="mt-2 flex flex-col gap-1">
                          {p.examples.slice(0, 2).map((ex, i) => (
                            <div key={i} className="rounded-lg bg-surface px-2 py-1 text-xs">
                              <div className="font-medium text-ink">{ex.sentence}</div>
                              <div className="text-ink-muted">{ex.translationVn}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
