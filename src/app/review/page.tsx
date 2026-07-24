import { getLanguages } from "@/lib/vocabStore";
import ReviewSession from "@/components/ReviewSession";

export default async function RandomReviewPage() {
  const languages = await getLanguages();
  const groups = languages.flatMap((l) => l.groups);

  return <ReviewSession groups={groups} title="Ôn tập ngẫu nhiên tất cả ngôn ngữ" backHref="/" />;
}
