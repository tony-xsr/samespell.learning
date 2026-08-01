import Link from "next/link";
import { notFound } from "next/navigation";
import { getGrammarData } from "@/lib/grammarStore";

export default async function GrammarMindmapIndexPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const data = getGrammarData(lang);
  if (!data) notFound();

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-2xl">
        <Link href={`/grammar/${lang}`} className="text-sm font-medium text-brand-600 hover:underline">
          ← {data.label}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">🗺️ Mindmap ngữ pháp</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Chọn 1 nhóm chức năng để xem dạng canvas toả nhánh — kéo, phóng to/thu nhỏ, bấm vào từng cấu
          trúc để xem chi tiết, giống mindmap từ vựng.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          {data.categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/grammar/${lang}/mindmap/${cat.id}`}
              className="flex items-center justify-between rounded-2xl border border-border bg-surface-2 px-5 py-4 shadow-sm hover:border-brand-300 hover:shadow-md"
            >
              <span className="font-semibold text-ink">{cat.titleVn}</span>
              <span className="text-xs text-ink-muted">{cat.points.length} điểm →</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
