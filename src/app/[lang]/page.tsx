import Link from "next/link";
import { notFound } from "next/navigation";
import { getLanguageData, wordCount } from "@/lib/vocabStore";
import NewGroupPrompt from "@/components/NewGroupPrompt";
import type { Language } from "@/types/vocab";

export default async function LanguagePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const data = await getLanguageData(lang);
  if (!data) notFound();

  const MAX_CHIPS = 6;

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
            <Link
              href={`/${lang}/review`}
              className="rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:brightness-105"
            >
              🗂️ Luyện tập cả {data.label}
            </Link>
          )}
        </div>

        <div className="mx-auto max-w-md">
          <NewGroupPrompt lang={lang as Language} existingReadings={data.groups.map((g) => g.reading)} />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {data.groups.map((group) => {
            const extraChips = group.roots.length - MAX_CHIPS;
            return (
              <Link
                key={group.id}
                href={`/${lang}/${group.id}`}
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
      </div>
    </main>
  );
}
