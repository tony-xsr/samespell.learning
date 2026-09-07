import { notFound } from "next/navigation";
import { getShapeLanguageData } from "@/lib/vocabStore";
import ReviewSession from "@/components/ReviewSession";

export default async function ShapeLanguageReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { lang } = await params;
  const query = await searchParams;
  const data = await getShapeLanguageData(lang);
  if (!data) notFound();

  const count = Number(query.count);
  const limit = Number.isFinite(count) && count > 0 ? count : undefined;

  return (
    <ReviewSession
      groups={data.groups}
      title={limit ? `Ôn ${limit} từ ngẫu nhiên — ${data.label}` : `Luyện tập ${data.label}`}
      backHref={`/shapes/${lang}`}
      limit={limit}
    />
  );
}
