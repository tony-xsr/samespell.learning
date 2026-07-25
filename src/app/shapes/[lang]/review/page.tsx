import { notFound } from "next/navigation";
import { getShapeLanguageData } from "@/lib/vocabStore";
import ReviewSession from "@/components/ReviewSession";

export default async function ShapeLanguageReviewPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const data = await getShapeLanguageData(lang);
  if (!data) notFound();

  return (
    <ReviewSession groups={data.groups} title={`Luyện tập ${data.label}`} backHref={`/shapes/${lang}`} />
  );
}
