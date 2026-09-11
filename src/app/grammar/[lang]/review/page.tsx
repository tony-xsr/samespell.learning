import { notFound } from "next/navigation";
import { getGrammarData } from "@/lib/grammarStore";
import GrammarReviewSession from "@/components/grammar/GrammarReviewSession";

export default async function GrammarReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { lang } = await params;
  const query = await searchParams;
  const data = getGrammarData(lang);
  if (!data) notFound();

  // ?category=<id> — chỉ luyện 1 nhóm chức năng thay vì toàn bộ điểm ngữ pháp (xem GrammarCategoryList
  // "🗂️ Luyện tập" ở mỗi nhóm) — người dùng phản hồi bấm "Luyện tập" ở trang ngữ pháp luyện HẾT toàn
  // bộ điểm, muốn mỗi nhóm có phần luyện tập riêng.
  const categoryParam = typeof query.category === "string" ? query.category : undefined;
  const category = categoryParam ? data.categories.find((c) => c.id === categoryParam) : undefined;

  return (
    <GrammarReviewSession
      data={data}
      lang={lang}
      backHref={`/grammar/${lang}`}
      categoryId={category?.id}
      categoryTitle={category?.titleVn}
    />
  );
}
