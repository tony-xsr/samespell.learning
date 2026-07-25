import { notFound } from "next/navigation";
import { getShapeGroup } from "@/lib/vocabStore";
import GroupExplorer from "@/components/GroupExplorer";

export default async function ShapeGroupPage({
  params,
}: {
  params: Promise<{ lang: string; groupId: string }>;
}) {
  const { lang, groupId } = await params;
  const group = await getShapeGroup(lang, groupId);
  if (!group) notFound();

  return <GroupExplorer initialGroup={group} lang={lang} basePath="/shapes" />;
}
