import Link from "next/link";
import { notFound } from "next/navigation";
import { getGrammarData, countGrammarPoints } from "@/lib/grammarStore";
import GrammarCategoryList from "@/components/grammar/GrammarCategoryList";

export default async function GrammarLangPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const data = getGrammarData(lang);
  if (!data) notFound();

  const total = countGrammarPoints(data);

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-5xl">
        <Link href="/grammar" className="text-sm font-medium text-brand-600 hover:underline">
          ← Ngôn ngữ khác
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">{data.label}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {data.categories.length} nhóm chức năng · {total} điểm ngữ pháp — soạn tay theo cấu trúc
              &ldquo;Trục A&rdquo;.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/grammar/${lang}/mindmap`}
              className="rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:brightness-105"
            >
              🗺️ Mindmap
            </Link>
            <Link
              href={`/grammar/${lang}/review`}
              className="rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:brightness-105"
            >
              🗂️ Luyện tập
            </Link>
            <Link
              href={`/grammar/${lang}/wizard`}
              className="rounded-full border-2 border-dashed border-brand-400 px-4 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-500/5"
            >
              🧭 Tôi muốn nói...
            </Link>
            <Link
              href={`/grammar/${lang}/timeline`}
              className="rounded-full border-2 border-dashed border-brand-400 px-4 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-500/5"
            >
              🕐 Lưới thời gian
            </Link>
            {data.confusionGroups.length > 0 && (
              <Link
                href={`/grammar/${lang}/confusion`}
                className="rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:brightness-105"
              >
                ⚡ Xem {data.confusionGroups.length} cụm dễ nhầm
              </Link>
            )}
            <Link
              href={`/grammar/${lang}/story`}
              className="rounded-full border-2 border-dotted border-ink-muted px-4 py-2 text-sm font-semibold text-ink-muted hover:bg-surface-3"
            >
              🔗 Chuỗi ngữ cảnh (thử nghiệm)
            </Link>
          </div>
        </div>

        <div className="mt-6">
          <GrammarCategoryList categories={data.categories} lang={lang} />
        </div>
      </div>
    </main>
  );
}
