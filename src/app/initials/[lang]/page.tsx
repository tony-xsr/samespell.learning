import Link from "next/link";
import { notFound } from "next/navigation";
import { loadLearnedKeySet } from "@/lib/personalCollectionsStore";
import { getInitialLanguageData } from "@/lib/vocabStore";
import GroupBrowser from "@/components/GroupBrowser";
import { toGroupSummaries } from "@/lib/groupSummary";
import type { SoundGroup } from "@/types/vocab";

const UNCATEGORIZED = "Khác";
const PINNED_FIRST = "Cặp ký tự gần giống (hình cận tự)";
const PINNED_LAST = "Cấu kiện âm cổ / hiếm gặp";

function groupByCategory(groups: SoundGroup[]): [string, SoundGroup[]][] {
  const map = new Map<string, SoundGroup[]>();
  for (const g of groups) {
    const cat = g.category ?? UNCATEGORIZED;
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(g);
  }
  const entries = [...map.entries()];
  entries.sort((a, b) => {
    if (a[0] === PINNED_FIRST) return -1;
    if (b[0] === PINNED_FIRST) return 1;
    if (a[0] === PINNED_LAST) return 1;
    if (b[0] === PINNED_LAST) return -1;
    return b[1].length - a[1].length;
  });
  return entries;
}

export default async function InitialLanguagePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const data = await getInitialLanguageData(lang);
  const learnedIds = await loadLearnedKeySet(lang, "initial");
  if (!data) notFound();

  const summaries = toGroupSummaries(data.groups, learnedIds);
  // Thứ tự chủ đề do trang quyết định (mỗi trục ghim chủ đề khác nhau), GroupBrowser chỉ nhận danh sách.
  const categoryOrder = groupByCategory(data.groups).map(([cat]) => cat);
  const showSections = categoryOrder.length > 1;

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-6xl">
        <Link href="/initials" className="text-sm font-medium text-brand-600 hover:underline">
          ← Cùng âm đầu pinyin
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">{data.label}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {showSections
                ? `${data.groups.length} nhóm, gom theo ${categoryOrder.length} chủ đề — lọc, tìm và đổi kiểu xem bên dưới.`
                : "Chọn một nhóm để xem mindmap các từ cùng phụ âm đầu pinyin."}
            </p>
          </div>
          {data.groups.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/initials/${lang}/review?count=15`}
                className="rounded-full border-2 border-brand-400 px-4 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-500/10"
              >
                🎲 Ôn 15 từ ngẫu nhiên
              </Link>
              <Link
                href={`/initials/${lang}/review`}
                className="rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:brightness-105"
              >
                🗂️ Luyện tập cả {data.label}
              </Link>
            </div>
          )}
        </div>

        <GroupBrowser
          groups={summaries}
          basePath={`/initials/${lang}`}
          categoryOrder={categoryOrder}
        />
      </div>
    </main>
  );
}
