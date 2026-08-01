import Link from "next/link";
import { notFound } from "next/navigation";
import { getGrammarData } from "@/lib/grammarStore";
import GrammarMindmapCanvas from "@/components/grammar/GrammarMindmapCanvas";

export default async function GrammarMindmapCategoryPage({
  params,
}: {
  params: Promise<{ lang: string; categoryId: string }>;
}) {
  const { lang, categoryId } = await params;
  const data = getGrammarData(lang);
  if (!data) notFound();
  const category = data.categories.find((c) => c.id === categoryId);
  if (!category) notFound();

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-6 sm:py-10">
      <div className="w-full max-w-5xl">
        <Link href={`/grammar/${lang}/mindmap`} className="text-sm font-medium text-brand-600 hover:underline">
          ← Chọn nhóm khác
        </Link>
        <h1 className="mt-2 text-xl font-bold tracking-tight text-ink">🗺️ {category.titleVn}</h1>

        <div className="mt-4">
          <GrammarMindmapCanvas category={category} lang={data.language} />
        </div>
      </div>
    </main>
  );
}
