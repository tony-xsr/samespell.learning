import { notFound } from "next/navigation";
import type { Language } from "@/types/vocab";
import type { GrammarQuizMode } from "@/lib/grammarQuizTypes";
import { getGrammarData } from "@/lib/grammarStore";
import GrammarQuizSession from "@/components/quiz/GrammarQuizSession";

const VALID_MODES: GrammarQuizMode[] = ["meaning", "usage"];

export default async function GrammarTestPlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; mode: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { lang, mode } = await params;
  const query = await searchParams;

  const data = getGrammarData(lang);
  if (!data) notFound();
  if (!VALID_MODES.includes(mode as GrammarQuizMode)) notFound();

  const reflex = query.reflex === "1";
  const explainMode = query.explain === "1";
  const categoryParam = typeof query.category === "string" ? query.category : undefined;
  const category = categoryParam ? data.categories.find((c) => c.id === categoryParam) : undefined;

  return (
    <GrammarQuizSession
      lang={lang as Language}
      mode={mode as GrammarQuizMode}
      reflex={reflex}
      explainMode={explainMode}
      categoryId={category?.id}
      categoryTitle={category?.titleVn}
    />
  );
}
