import { notFound } from "next/navigation";
import { getFalseFriendGroup } from "@/lib/vocabStore";
import ReviewSession from "@/components/ReviewSession";

export default async function FalseFriendReviewPage({
  params,
}: {
  params: Promise<{ lang: string; groupId: string }>;
}) {
  const { lang, groupId } = await params;
  const group = await getFalseFriendGroup(lang, groupId);
  if (!group) notFound();

  return (
    <ReviewSession
      groups={[group]}
      title={`Nhóm bẫy nghĩa "${group.reading}"`}
      backHref={`/false-friends/${lang}/${groupId}`}
    />
  );
}
