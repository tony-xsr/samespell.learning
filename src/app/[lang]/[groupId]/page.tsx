import { notFound } from "next/navigation";
import { getSoundGroup } from "@/lib/vocabStore";
import GroupExplorer from "@/components/GroupExplorer";

export default async function GroupPage({
  params,
}: {
  params: Promise<{ lang: string; groupId: string }>;
}) {
  const { lang, groupId } = await params;
  const group = await getSoundGroup(lang, groupId);
  if (!group) notFound();

  return <GroupExplorer initialGroup={group} lang={lang} />;
}
