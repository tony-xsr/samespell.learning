import Link from "next/link";
import { getGrammarLanguages, countGrammarPoints } from "@/lib/grammarStore";

const LANG_ICON: Record<string, string> = { zh: "🇨🇳", ko: "🇰🇷", ja: "🇯🇵" };
const LANG_LABEL: Record<string, string> = { ko: "Ngữ pháp tiếng Hàn", ja: "Ngữ pháp tiếng Nhật" };
const ALL_LANGS = ["ko", "ja"] as const;

export default function GrammarHome() {
  const languages = getGrammarLanguages();
  const byLang = new Map(languages.map((l) => [l.language, l]));

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="text-sm font-medium text-brand-600 hover:underline">
          ← Trang chủ
        </Link>

        <div className="mt-3 rounded-3xl bg-gradient-to-br from-brand-600 to-accent-500 p-6 text-white shadow-lg">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Mindmap ngữ pháp</h1>
          <p className="mt-2 text-sm text-white/90">
            Học ngữ pháp theo <span className="font-semibold">chức năng</span> (trợ từ, chia động từ,
            liên từ...) và theo <span className="font-semibold">cụm dễ nhầm</span> — soạn tay, kiểm chứng
            kỹ, không do AI tự sinh.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {ALL_LANGS.map((lang) => {
            const data = byLang.get(lang);
            const total = data ? countGrammarPoints(data) : 0;
            const disabled = !data || total === 0;
            return (
              <div
                key={lang}
                className={`flex items-center gap-3 rounded-2xl border border-border bg-surface-2 px-5 py-4 shadow-sm transition ${
                  disabled ? "opacity-40" : "hover:border-brand-300 hover:shadow-md"
                }`}
              >
                <Link
                  href={disabled ? "#" : `/grammar/${lang}`}
                  aria-disabled={disabled}
                  className={`flex flex-1 items-center gap-4 ${disabled ? "pointer-events-none" : ""}`}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xl">
                    {LANG_ICON[lang]}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-ink">{LANG_LABEL[lang]}</div>
                    <div className="mt-0.5 text-xs text-ink-muted">
                      {total > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700">
                          {total} điểm ngữ pháp
                        </span>
                      ) : (
                        "Sắp ra mắt"
                      )}
                    </div>
                  </div>
                  <span className="text-brand-500">→</span>
                </Link>
                {!disabled && (
                  <Link
                    href={`/grammar/${lang}/review`}
                    aria-label={`Luyện tập ${LANG_LABEL[lang]}`}
                    className="shrink-0 rounded-full border border-border bg-surface-3 px-3 py-2 text-xs font-semibold text-ink hover:border-brand-300 hover:bg-surface"
                  >
                    🗂️ Luyện tập
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
