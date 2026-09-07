import { notFound } from "next/navigation";
import { getTopicLanguageData } from "@/lib/topicStore";
import ReviewSession from "@/components/ReviewSession";

export default async function TopicReviewPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const data = getTopicLanguageData(lang);
  if (!data) notFound();

  return (
    <ReviewSession
      topics={data.topics}
      title={`Luyện tập ngẫu nhiên ${data.label}`}
      backHref={`/topics/${lang}/mindmap`}
    />
  );
}
