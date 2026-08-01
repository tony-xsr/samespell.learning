import { notFound } from "next/navigation";
import { getGrammarData } from "@/lib/grammarStore";
import GrammarReviewSession from "@/components/grammar/GrammarReviewSession";

export default async function GrammarReviewPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const data = getGrammarData(lang);
  if (!data) notFound();

  return <GrammarReviewSession data={data} lang={lang} backHref={`/grammar/${lang}`} />;
}
