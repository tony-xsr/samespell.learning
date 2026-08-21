import Link from "next/link";
import { getScenarioLanguageData } from "@/lib/scenarioStore";

const LANG_ICON: Record<string, string> = { zh: "🇨🇳", ja: "🇯🇵", ko: "🇰🇷" };
const LANG_LABEL: Record<string, string> = {
  zh: "Chuỗi kịch bản tiếng Trung",
  ja: "Chuỗi kịch bản tiếng Nhật",
  ko: "Chuỗi kịch bản tiếng Hàn",
};
const ALL_LANGS = ["zh", "ja", "ko"] as const;

export default function ScenariosHome() {
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="text-sm font-medium text-brand-600 hover:underline">
          ← Trang chủ
        </Link>

        <div className="mt-3 rounded-3xl bg-gradient-to-br from-rose-600 to-orange-500 p-6 text-white shadow-lg">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">🎬 Chuỗi kịch bản</h1>
          <p className="mt-2 text-sm text-white/90">
            Thử nghiệm: từ vựng nối theo BỐI CẢNH/TÌNH HUỐNG thực tế (vd chuyển nhà, học lái xe thi
            trượt rồi đậu) — khác trục &ldquo;Nối đuôi&rdquo; vốn nối theo chữ Hán dùng chung.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {ALL_LANGS.map((lang) => {
            const data = getScenarioLanguageData(lang);
            const total = data?.scenarios.length ?? 0;
            const disabled = total === 0;
            return (
              <Link
                key={lang}
                href={disabled ? "#" : `/scenarios/${lang}`}
                aria-disabled={disabled}
                className={`flex items-center gap-4 rounded-2xl border border-border bg-surface-2 px-5 py-4 shadow-sm transition ${
                  disabled ? "pointer-events-none opacity-40" : "hover:border-rose-300 hover:shadow-md"
                }`}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xl">
                  {LANG_ICON[lang]}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-ink">{LANG_LABEL[lang]}</div>
                  <div className="mt-0.5 text-xs text-ink-muted">
                    {total > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 font-medium text-rose-700">
                        {total} chuỗi
                      </span>
                    ) : (
                      "Sắp ra mắt"
                    )}
                  </div>
                </div>
                <span className="text-rose-500">→</span>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
