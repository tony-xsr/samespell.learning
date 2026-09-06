import Link from "next/link";

const LANG_ICON: Record<string, string> = { zh: "🇨🇳", ko: "🇰🇷", ja: "🇯🇵", en: "🇬🇧" };
const LANG_LABEL: Record<string, string> = {
  zh: "Kiểm tra tiếng Trung",
  ko: "Kiểm tra tiếng Hàn",
  ja: "Kiểm tra tiếng Nhật",
  en: "Kiểm tra tiếng Anh",
};
const ALL_LANGS = ["zh", "ja", "ko", "en"] as const;

export default function TestHome() {
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="text-sm font-medium text-brand-600 hover:underline">
          ← Trang chủ
        </Link>

        <div className="quiz-fade-in-up mt-3 rounded-3xl bg-gradient-to-br from-sky-600 to-sky-400 p-6 text-white shadow-lg">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">🧪 Kiểm tra kiến thức</h1>
          <p className="mt-2 text-sm text-white/90">
            Trắc nghiệm nghĩa, cách đọc, điền từ vào câu — và chế độ{" "}
            <span className="font-semibold">phản xạ đếm giờ</span>. Câu hỏi được sinh ngẫu nhiên từ
            toàn bộ kho từ vựng, không lặp lại y hệt lần nào.
          </p>
        </div>

        <Link
          href="/test/mixed"
          style={{ animationDelay: "60ms" }}
          className="quiz-fade-in-up group mt-6 flex items-center gap-4 rounded-2xl border-2 border-dashed border-sky-400 bg-sky-500/5 px-5 py-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-sky-500 hover:bg-sky-500/10 hover:shadow-md active:scale-[0.99]"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xl">
            🌐
          </div>
          <div className="flex-1">
            <div className="font-semibold text-ink">Trộn ngôn ngữ</div>
            <div className="mt-0.5 text-xs text-ink-muted">
              Học cả 4 ngôn ngữ trong 1 phiên — mỗi câu hỏi 1 ngôn ngữ ngẫu nhiên
            </div>
          </div>
          <span className="text-sky-500 transition-transform group-hover:translate-x-0.5">→</span>
        </Link>

        <div className="mt-6 flex flex-col gap-3">
          {ALL_LANGS.map((lang, i) => (
            <Link
              key={lang}
              href={`/test/${lang}`}
              style={{ animationDelay: `${120 + i * 60}ms` }}
              className="quiz-fade-in-up flex items-center gap-4 rounded-2xl border border-border bg-surface-2 px-5 py-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md active:scale-[0.99]"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xl">
                {LANG_ICON[lang]}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-ink">{LANG_LABEL[lang]}</div>
                <div className="mt-0.5 text-xs text-ink-muted">Trắc nghiệm · Phản xạ · Điền từ</div>
              </div>
              <span className="text-sky-500">→</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
