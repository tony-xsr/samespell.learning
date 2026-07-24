import { notFound } from "next/navigation";
import { getSoundGroup } from "@/lib/vocabStore";
import ReviewSession from "@/components/ReviewSession";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ lang: string; groupId: string }>;
}) {
  const { lang, groupId } = await params;
  const group = await getSoundGroup(lang, groupId);
  if (!group) notFound();

  return (
    <ReviewSession groups={[group]} title={`Nhóm âm "${group.reading}"`} backHref={`/${lang}/${groupId}`} />
  );
}
