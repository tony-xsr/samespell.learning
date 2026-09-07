import { notFound } from "next/navigation";
import { getFalseFriendLanguageData } from "@/lib/vocabStore";
import ReviewSession from "@/components/ReviewSession";

export default async function FalseFriendLanguageReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { lang } = await params;
  const query = await searchParams;
  const data = await getFalseFriendLanguageData(lang);
  if (!data) notFound();

  const count = Number(query.count);
  const limit = Number.isFinite(count) && count > 0 ? count : undefined;

  return (
    <ReviewSession
      groups={data.groups}
      title={limit ? `Ôn ${limit} từ ngẫu nhiên — ${data.label}` : `Luyện tập ${data.label}`}
      backHref={`/false-friends/${lang}`}
      limit={limit}
    />
  );
}
