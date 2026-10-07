import Link from "next/link";
import { getLearnedGroupsView, groupKindLabel } from "@/lib/personalCollectionsView";
import type { ResolvedLearnedItem } from "@/lib/personalCollectionsView";

const LANG_ICON: Record<string, string> = { zh: "🇨🇳", ko: "🇰🇷", ja: "🇯🇵", en: "🇬🇧", es: "🇪🇸" };
const LANG_LABEL: Record<string, string> = {
  zh: "Tiếng Trung",
  ko: "Tiếng Hàn",
  ja: "Tiếng Nhật",
  en: "Tiếng Anh",
  es: "Tiếng Tây Ban Nha",
};

function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/** Gom theo NGÀY học (mới nhất lên đầu) thay vì theo ngôn ngữ — vì câu hỏi người học hay đặt ra là
 * "dạo này mình đã học được những gì", chứ không phải "mục nào có bao nhiêu". */
function groupByDay(refs: ResolvedLearnedItem[]): [string, ResolvedLearnedItem[]][] {
  const byDay = new Map<string, ResolvedLearnedItem[]>();
  for (const ref of refs) {
    const day = ref.learnedAt.slice(0, 10);
    const list = byDay.get(day);
    if (list) list.push(ref);
    else byDay.set(day, [ref]);
  }
  return [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

export default async function LearnedPage() {
  const learned = await getLearnedGroupsView();
  const days = groupByDay(learned);

  const perLang = new Map<string, number>();
  for (const l of learned) perLang.set(l.language, (perLang.get(l.language) ?? 0) + 1);

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-2xl">
        <Link href="/" className="text-sm font-medium text-brand-600 hover:underline">
          ← Trang chủ
        </Link>

        <div className="mt-3 rounded-3xl bg-gradient-to-br from-emerald-500 to-brand-600 p-6 text-white shadow-lg">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">✅ Đã học</h1>
          <p className="mt-2 text-sm text-white/90">
            Danh sách các mindmap bạn đã tự đánh dấu học xong, xếp theo ngày gần nhất. Bấm vào từng
            dòng để mở lại mindmap đó.
          </p>
        </div>

        {learned.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-border-strong bg-surface-2 px-5 py-8 text-center">
            <p className="text-sm text-ink-muted">
              Chưa có mindmap nào được đánh dấu. Mở một mindmap bất kỳ rồi bấm nút{" "}
              <span className="font-semibold text-ink">◻ Đánh dấu đã học</span> ở đầu trang.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                Tổng {learned.length} mindmap
              </span>
              {[...perLang.entries()].map(([lang, n]) => (
                <span
                  key={lang}
                  className="rounded-full bg-surface-3 px-3 py-1 text-sm font-medium text-ink-muted"
                >
                  {LANG_ICON[lang] ?? "🌐"} {LANG_LABEL[lang] ?? lang} · {n}
                </span>
              ))}
            </div>

            {days.map(([day, refs]) => (
              <section key={day} className="mt-6">
                <h2 className="text-sm font-semibold text-ink-muted">
                  📅 {formatDay(refs[0].learnedAt)} · {refs.length} mindmap
                </h2>
                <div className="mt-2 flex flex-col gap-2">
                  {refs.map((ref) => (
                    <Link
                      key={ref.itemId}
                      href={ref.href}
                      className="flex items-center gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3 shadow-sm transition hover:border-brand-300 hover:shadow-md"
                    >
                      <span className="text-xl">{LANG_ICON[ref.language] ?? "🌐"}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-ink">{ref.reading}</div>
                        <div className="mt-0.5 text-xs text-ink-muted">
                          {LANG_LABEL[ref.language] ?? ref.language} · {groupKindLabel(ref.groupKind)}
                          {ref.wordCount > 0 ? ` · ${ref.wordCount} từ` : ""}
                        </div>
                      </div>
                      <span className="text-brand-500">→</span>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </div>
    </main>
  );
}
