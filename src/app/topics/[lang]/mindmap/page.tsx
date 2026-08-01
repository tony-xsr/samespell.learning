import Link from "next/link";
import { notFound } from "next/navigation";
import { getTopicLanguageData } from "@/lib/topicStore";

export default async function TopicMindmapIndexPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const data = getTopicLanguageData(lang);
  if (!data) notFound();

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-2xl">
        <Link href="/topics" className="text-sm font-medium text-brand-600 hover:underline">
          ← {data.label}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">🧩 Mindmap theo chủ đề</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Thử nghiệm: từ vựng gom theo chủ đề/cảm xúc/hoạt động liên quan (khác trục đồng âm) — chọn 1
          chủ đề để xem dạng canvas toả nhánh, từ lõi mở rộng ra từ liên quan bằng nét đứt.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          {data.topics.map((topic) => (
            <Link
              key={topic.id}
              href={`/topics/${lang}/mindmap/${topic.id}`}
              className="flex items-center justify-between rounded-2xl border border-border bg-surface-2 px-5 py-4 shadow-sm hover:border-brand-300 hover:shadow-md"
            >
              <span className="font-semibold text-ink">
                {topic.titleNative} <span className="text-ink-muted">— {topic.titleVn}</span>
              </span>
              <span className="text-xs text-ink-muted">{topic.branches.length} nhánh →</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
