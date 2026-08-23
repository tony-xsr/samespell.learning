import { notFound } from "next/navigation";
import { getInitialGroup } from "@/lib/vocabStore";
import GroupExplorer from "@/components/GroupExplorer";

export default async function InitialGroupPage({
  params,
}: {
  params: Promise<{ lang: string; groupId: string }>;
}) {
  const { lang, groupId } = await params;
  const group = await getInitialGroup(lang, groupId);
  if (!group) notFound();

  return <GroupExplorer initialGroup={group} lang={lang} basePath="/initials" />;
}
