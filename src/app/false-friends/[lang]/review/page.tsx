import { notFound } from "next/navigation";
import { getFalseFriendLanguageData } from "@/lib/vocabStore";
import ReviewSession from "@/components/ReviewSession";

export default async function FalseFriendLanguageReviewPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const data = await getFalseFriendLanguageData(lang);
  if (!data) notFound();

  return (
    <ReviewSession
      groups={data.groups}
      title={`Luyện tập ${data.label}`}
      backHref={`/false-friends/${lang}`}
    />
  );
}
