import { notFound } from "next/navigation";
import { getInitialGroup } from "@/lib/vocabStore";
import ReviewSession from "@/components/ReviewSession";

export default async function InitialReviewPage({
  params,
}: {
  params: Promise<{ lang: string; groupId: string }>;
}) {
  const { lang, groupId } = await params;
  const group = await getInitialGroup(lang, groupId);
  if (!group) notFound();

  return (
    <ReviewSession
      groups={[group]}
      title={`Nhóm âm đầu "${group.reading}"`}
      backHref={`/initials/${lang}/${groupId}`}
    />
  );
}
