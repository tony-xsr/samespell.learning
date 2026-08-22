import { notFound } from "next/navigation";
import { getFalseFriendGroup } from "@/lib/vocabStore";
import GroupExplorer from "@/components/GroupExplorer";

export default async function FalseFriendGroupPage({
  params,
}: {
  params: Promise<{ lang: string; groupId: string }>;
}) {
  const { lang, groupId } = await params;
  const group = await getFalseFriendGroup(lang, groupId);
  if (!group) notFound();

  return <GroupExplorer initialGroup={group} lang={lang} basePath="/false-friends" />;
}
