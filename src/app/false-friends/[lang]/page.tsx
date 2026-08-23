import Link from "next/link";
import { notFound } from "next/navigation";
import { getFalseFriendLanguageData, wordCount } from "@/lib/vocabStore";
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

function slugify(text: string) {
  return "cat-" + text.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase();
}

export default async function FalseFriendLanguagePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const data = await getFalseFriendLanguageData(lang);
  if (!data) notFound();

  const MAX_CHIPS = 6;
  const sections = groupByCategory(data.groups);
  const showSections = sections.length > 1;

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-6xl">
        <Link href="/false-friends" className="text-sm font-medium text-brand-600 hover:underline">
          ← Bẫy nghĩa
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">{data.label}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {showSections
                ? `${data.groups.length} nhóm, gom theo ${sections.length} chủ đề — bấm để mở rộng từng chủ đề.`
                : "Chọn một nhóm để xem mindmap các từ ghép dùng chung 1 chữ nhưng nghĩa lệch nhau."}
            </p>
          </div>
          {data.groups.length > 0 && (
            <Link
              href={`/false-friends/${lang}/review`}
              className="rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:brightness-105"
            >
              🗂️ Luyện tập cả {data.label}
            </Link>
          )}
        </div>

        {showSections && (
          <nav className="mt-4 flex flex-wrap gap-1.5 border-b border-border pb-4">
            {sections.map(([cat, groups]) => {
              const words = groups.reduce((sum, g) => sum + wordCount(g), 0);
              return (
                <a
                  key={cat}
                  href={`#${slugify(cat)}`}
                  className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-ink-muted hover:bg-surface-3 hover:text-ink"
                >
                  {cat} <span className="text-ink-muted">({groups.length} nhóm · {words} từ)</span>
                </a>
              );
            })}
          </nav>
        )}

        {sections.map(([cat, groups]) => (
          <details
            key={cat}
            id={slugify(cat)}
            open={!showSections || groups.length <= 30}
            className="group mt-6 scroll-mt-4"
          >
            {showSections && (
              <summary className="cursor-pointer list-none">
                <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-4 py-2.5 hover:bg-surface-3">
                  <span className="text-base font-bold text-ink">{cat}</span>
                  <span className="text-sm font-medium text-ink-muted">
                    {groups.length} nhóm · {groups.reduce((sum, g) => sum + wordCount(g), 0)} từ
                  </span>
                  <span className="ml-auto text-ink-muted transition-transform group-open:rotate-90">
                    ▶
                  </span>
                </div>
              </summary>
            )}
            <div
              className={`grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 ${showSections ? "mt-3" : ""}`}
            >
              {groups.map((group) => {
                const extraChips = group.roots.length - MAX_CHIPS;
                return (
                  <Link
                    key={group.id}
                    href={`/false-friends/${lang}/${group.id}`}
                    className="flex flex-col rounded-2xl border border-border bg-surface-2 px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
                  >
                    <span className="text-lg font-bold text-brand-600">{group.reading}</span>
                    <span className="mt-0.5 text-xs font-medium text-accent-600">
                      {group.roots.length} chữ · {wordCount(group)} từ
                    </span>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {group.roots.slice(0, MAX_CHIPS).map((r) => (
                        <span key={r.id} className="rounded-lg bg-surface-3 px-2 py-0.5 text-sm text-ink">
                          {r.character}
                        </span>
                      ))}
                      {extraChips > 0 && (
                        <span className="rounded-lg px-2 py-0.5 text-sm text-ink-muted">+{extraChips}</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </details>
        ))}
      </div>
    </main>
  );
}
