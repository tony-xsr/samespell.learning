import Link from "next/link";
import { notFound } from "next/navigation";
import { loadLearnedKeySet } from "@/lib/personalCollectionsStore";
import { getLanguageData } from "@/lib/vocabStore";
import GroupBrowser from "@/components/GroupBrowser";
import { toGroupSummaries } from "@/lib/groupSummary";
import NewGroupPrompt from "@/components/NewGroupPrompt";
import type { Language } from "@/types/vocab";

export default async function LanguagePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const data = await getLanguageData(lang);
  const learnedIds = await loadLearnedKeySet(lang, "sound");
  if (!data) notFound();

  const summaries = toGroupSummaries(data.groups, learnedIds, data.language);

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-6xl">
        <Link href="/" className="text-sm font-medium text-brand-600 hover:underline">
          ← Trang chủ
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">{data.label}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {data.groups.length} nhóm âm · Chọn một nhóm để xem mindmap và học thẻ từ.
            </p>
          </div>
          {data.groups.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/${lang}/review?count=15`}
                className="rounded-full border-2 border-brand-400 px-4 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-500/10"
              >
                🎲 Ôn 15 từ ngẫu nhiên
              </Link>
              <Link
                href={`/${lang}/review`}
                className="rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:brightness-105"
              >
                🗂️ Luyện tập cả {data.label}
              </Link>
            </div>
          )}
        </div>

        <div className="mx-auto max-w-md">
          <NewGroupPrompt lang={lang as Language} existingReadings={data.groups.map((g) => g.reading)} />
        </div>

        <GroupBrowser
          groups={summaries}
          basePath={`/${lang}`}
          categoryOrder={[]}
          language={data.language}
        />
      </div>
    </main>
  );
}
