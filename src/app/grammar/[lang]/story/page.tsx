import Link from "next/link";
import { notFound } from "next/navigation";
import { getGrammarData } from "@/lib/grammarStore";
import {
  getGrammarBranchingStories,
  getGrammarStories,
  resolveBranchingStory,
  resolveStory,
} from "@/lib/grammarStories";
import GrammarStoryGrid from "@/components/grammar/GrammarStoryGrid";

export default async function GrammarStoryPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const data = getGrammarData(lang);
  if (!data) notFound();

  const stories = getGrammarStories(lang).map((story) => resolveStory(data, story));
  const branchingStories = getGrammarBranchingStories(lang).map((story) => resolveBranchingStory(data, story));

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-3xl">
        <Link href={`/grammar/${lang}`} className="text-sm font-medium text-brand-600 hover:underline">
          ← {data.label}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">🔗 Chuỗi ngữ cảnh</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Nối các điểm ngữ pháp đã có thành 1 mạch câu chuyện liền mạch, thay vì xem rời rạc từng điểm.
          Bấm vào 1 thẻ để xem toàn màn hình.
        </p>

        {stories.length === 0 && branchingStories.length === 0 ? (
          <p className="mt-6 text-sm text-ink-muted">Chưa có chuỗi ngữ cảnh nào cho ngôn ngữ này.</p>
        ) : (
          <GrammarStoryGrid stories={stories} branchingStories={branchingStories} lang={data.language} />
        )}
      </div>
    </main>
  );
}
