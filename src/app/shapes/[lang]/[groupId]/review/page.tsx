import { notFound } from "next/navigation";
import { getShapeGroup } from "@/lib/vocabStore";
import ReviewSession from "@/components/ReviewSession";

export default async function ShapeReviewPage({
  params,
}: {
  params: Promise<{ lang: string; groupId: string }>;
}) {
  const { lang, groupId } = await params;
  const group = await getShapeGroup(lang, groupId);
  if (!group) notFound();

  return (
    <ReviewSession
      groups={[group]}
      title={`Nhóm hình "${group.reading}"`}
      backHref={`/shapes/${lang}/${groupId}`}
    />
  );
}
