import Link from "next/link";
import { notFound } from "next/navigation";
import { getTopicGroup } from "@/lib/topicStore";
import TopicMindmapCanvas from "@/components/topics/TopicMindmapCanvas";

export default async function TopicMindmapDetailPage({
  params,
}: {
  params: Promise<{ lang: string; topicId: string }>;
}) {
  const { lang, topicId } = await params;
  const topic = getTopicGroup(lang, topicId);
  if (!topic) notFound();

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-6 sm:py-10">
      <div className="w-full max-w-5xl">
        <Link href={`/topics/${lang}/mindmap`} className="text-sm font-medium text-brand-600 hover:underline">
          ← Chọn chủ đề khác
        </Link>
        <h1 className="mt-2 text-xl font-bold tracking-tight text-ink">
          🧩 {topic.titleNative} <span className="text-ink-muted">— {topic.titleVn}</span>
        </h1>

        <div className="mt-4">
          <TopicMindmapCanvas topic={topic} />
        </div>
      </div>
    </main>
  );
}
