import { notFound } from "next/navigation";
import { getLanguageData } from "@/lib/vocabStore";
import ReviewSession from "@/components/ReviewSession";

export default async function LanguageReviewPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const data = await getLanguageData(lang);
  if (!data) notFound();

  return <ReviewSession groups={data.groups} title={`Luyện tập ${data.label}`} backHref={`/${lang}`} />;
}
