import { notFound } from "next/navigation";
import { getInitialLanguageData } from "@/lib/vocabStore";
import ReviewSession from "@/components/ReviewSession";

export default async function InitialLanguageReviewPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const data = await getInitialLanguageData(lang);
  if (!data) notFound();

  return (
    <ReviewSession groups={data.groups} title={`Luyện tập ${data.label}`} backHref={`/initials/${lang}`} />
  );
}
