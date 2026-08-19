import Link from "next/link";
import { getCharAntonymData } from "@/lib/wordClusterStore";

const LANG_ICON: Record<string, string> = { zh: "🇨🇳", ja: "🇯🇵", ko: "🇰🇷" };
const LANG_LABEL: Record<string, string> = {
  zh: "Cặp chữ trái nghĩa tiếng Trung",
  ja: "Cặp chữ trái nghĩa tiếng Nhật",
  ko: "Cặp chữ trái nghĩa tiếng Hàn",
};
const ALL_LANGS = ["zh", "ja", "ko"] as const;

export default function AntonymCharsHome() {
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="text-sm font-medium text-brand-600 hover:underline">
          ← Trang chủ
        </Link>

        <div className="mt-3 rounded-3xl bg-gradient-to-br from-amber-600 to-orange-500 p-6 text-white shadow-lg">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">⇔ Cặp chữ trái nghĩa</h1>
          <p className="mt-2 text-sm text-white/90">
            Thử nghiệm: 2 chữ gốc trái nghĩa nhau, mỗi chữ toả ra 1 "gia đình" từ ghép riêng — đối lập
            ngay từ chữ gốc.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {ALL_LANGS.map((lang) => {
            const data = getCharAntonymData(lang);
            const total = data?.pairs.length ?? 0;
            const disabled = total === 0;
            return (
              <Link
                key={lang}
                href={disabled ? "#" : `/antonym-chars/${lang}`}
                aria-disabled={disabled}
                className={`flex items-center gap-4 rounded-2xl border border-border bg-surface-2 px-5 py-4 shadow-sm transition ${
                  disabled ? "pointer-events-none opacity-40" : "hover:border-amber-300 hover:shadow-md"
                }`}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xl">
                  {LANG_ICON[lang]}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-ink">{LANG_LABEL[lang]}</div>
                  <div className="mt-0.5 text-xs text-ink-muted">
                    {total > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
                        {total} cặp chữ
                      </span>
                    ) : (
                      "Sắp ra mắt"
                    )}
                  </div>
                </div>
                <span className="text-amber-500">→</span>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
