import Link from "next/link";
import { getTopicLanguageData } from "@/lib/topicStore";

const LANG_ICON: Record<string, string> = { zh: "🇨🇳", ko: "🇰🇷", ja: "🇯🇵" };
const LANG_LABEL: Record<string, string> = { ko: "Chủ đề tiếng Hàn", ja: "Chủ đề tiếng Nhật", zh: "Chủ đề tiếng Trung" };
const ALL_LANGS = ["ko", "ja", "zh"] as const;

export default function TopicsHome() {
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="text-sm font-medium text-brand-600 hover:underline">
          ← Trang chủ
        </Link>

        <div className="mt-3 rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-500 p-6 text-white shadow-lg">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">🧩 Mindmap theo chủ đề</h1>
          <p className="mt-2 text-sm text-white/90">
            Thử nghiệm: từ vựng gom theo <span className="font-semibold">chủ đề/cảm xúc/hoạt động</span>{" "}
            liên quan (khác trục đồng âm) — cụm từ lõi mở rộng ra từ liên quan bằng nét đứt.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {ALL_LANGS.map((lang) => {
            const data = getTopicLanguageData(lang);
            const total = data?.topics.length ?? 0;
            const disabled = total === 0;
            return (
              <Link
                key={lang}
                href={disabled ? "#" : `/topics/${lang}/mindmap`}
                aria-disabled={disabled}
                className={`flex items-center gap-4 rounded-2xl border border-border bg-surface-2 px-5 py-4 shadow-sm transition ${
                  disabled ? "pointer-events-none opacity-40" : "hover:border-emerald-300 hover:shadow-md"
                }`}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xl">
                  {LANG_ICON[lang]}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-ink">{LANG_LABEL[lang]}</div>
                  <div className="mt-0.5 text-xs text-ink-muted">
                    {total > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                        {total} chủ đề
                      </span>
                    ) : (
                      "Sắp ra mắt"
                    )}
                  </div>
                </div>
                <span className="text-emerald-500">→</span>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
