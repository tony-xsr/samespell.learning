import { notFound } from "next/navigation";
import { getTopicLanguageData } from "@/lib/topicStore";
import ReviewSession from "@/components/ReviewSession";

export default async function TopicReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { lang } = await params;
  const query = await searchParams;
  const data = getTopicLanguageData(lang);
  if (!data) notFound();

  const count = Number(query.count);
  const limit = Number.isFinite(count) && count > 0 ? count : undefined;

  return (
    <ReviewSession
      topics={data.topics}
      title={limit ? `Ôn ${limit} từ ngẫu nhiên — ${data.label}` : `Luyện tập ${data.label}`}
      backHref={`/topics/${lang}/mindmap`}
      limit={limit}
    />
  );
}
