import { notFound } from "next/navigation";
import { getSoundGroup } from "@/lib/vocabStore";
import ReviewSession from "@/components/ReviewSession";

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; groupId: string }>;
  /** `?count=N` đặt cỡ phiên ôn — giống các trang ôn cấp ngôn ngữ. Không truyền thì `ReviewSession`
   * tự chia theo `DEFAULT_SESSION_SIZE` (xem Features.md mục 33: nhóm lớn mà bắt ôn một lèo thì
   * không ai ôn hết). */
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { lang, groupId } = await params;
  const query = await searchParams;
  const group = await getSoundGroup(lang, groupId);
  if (!group) notFound();

  const count = Number(query.count);
  const limit = Number.isFinite(count) && count > 0 ? count : undefined;

  return (
    <ReviewSession
      groups={[group]}
      title={`Nhóm âm "${group.reading}"`}
      backHref={`/${lang}/${groupId}`}
      limit={limit}
    />
  );
}
