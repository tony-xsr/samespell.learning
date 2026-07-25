import Link from "next/link";
import { getShapeLanguages, wordCount } from "@/lib/vocabStore";

const LANG_ICON: Record<string, string> = { zh: "🇨🇳", ko: "🇰🇷", ja: "🇯🇵" };

export default async function ShapesHome() {
  const languages = await getShapeLanguages();

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="text-sm font-medium text-brand-600 hover:underline">
          ← Trang chủ
        </Link>

        <div className="mt-3 rounded-3xl bg-gradient-to-br from-accent-500 to-brand-600 p-6 text-white shadow-lg">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Nhóm hình chữ</h1>
          <p className="mt-2 text-sm text-white/90">
            Học theo <span className="font-semibold">形近字</span> (hình cận tự) — những chữ Hán/Kanji
            VIẾT gần giống nhau (khác nhau một nét nhỏ) nhưng đọc và nghĩa hoàn toàn khác nhau. Trục
            nhầm lẫn này khác với nhóm âm (đọc giống nhau) ở phần chính của app.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {languages.map((lang) => {
            const total = lang.groups.reduce((sum, g) => sum + wordCount(g), 0);
            const disabled = lang.groups.length === 0;
            return (
              <div
                key={lang.language}
                className={`flex items-center gap-3 rounded-2xl border border-border bg-surface-2 px-5 py-4 shadow-sm transition ${
                  disabled ? "opacity-40" : "hover:border-brand-300 hover:shadow-md"
                }`}
              >
                <Link
                  href={disabled ? "#" : `/shapes/${lang.language}`}
                  aria-disabled={disabled}
                  className={`flex flex-1 items-center gap-4 ${disabled ? "pointer-events-none" : ""}`}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xl">
                    {LANG_ICON[lang.language] ?? "🌐"}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-ink">{lang.label}</div>
                    <div className="mt-0.5 text-xs text-ink-muted">
                      {lang.groups.length > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700">
                          {lang.groups.length} nhóm hình · {total} từ
                        </span>
                      ) : (
                        "Sắp ra mắt"
                      )}
                    </div>
                  </div>
                  <span className="text-brand-500">→</span>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
