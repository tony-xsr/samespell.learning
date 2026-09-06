import Link from "next/link";
import { notFound } from "next/navigation";

const VALID_LANGS = ["zh", "ja", "ko", "en", "mixed"] as const;
type TestLang = (typeof VALID_LANGS)[number];

const LANG_ICON: Record<TestLang, string> = { zh: "🇨🇳", ko: "🇰🇷", ja: "🇯🇵", en: "🇬🇧", mixed: "🌐" };
const LANG_LABEL: Record<TestLang, string> = {
  zh: "Tiếng Trung",
  ko: "Tiếng Hàn",
  ja: "Tiếng Nhật",
  en: "Tiếng Anh",
  mixed: "Trộn ngôn ngữ",
};

const MODES = [
  {
    id: "meaning",
    icon: "🧠",
    title: "Trắc nghiệm nghĩa",
    desc: "Nhìn từ, chọn đúng nghĩa tiếng Việt",
  },
  {
    id: "reading",
    icon: "🔤",
    title: "Trắc nghiệm cách đọc",
    desc: "Nhìn từ, chọn đúng cách đọc/phiên âm",
  },
  {
    id: "cloze",
    icon: "✏️",
    title: "Điền từ vào câu",
    desc: "Chọn từ đúng để hoàn thành câu ví dụ",
  },
] as const;

export default async function TestModePicker({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!VALID_LANGS.includes(lang as TestLang)) notFound();
  const testLang = lang as TestLang;

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-md">
        <Link href="/test" className="text-sm font-medium text-brand-600 hover:underline">
          ← Chọn ngôn ngữ khác
        </Link>

        <div className="quiz-fade-in-up mt-3 rounded-3xl bg-gradient-to-br from-sky-600 to-sky-400 p-6 text-white shadow-lg">
          <div className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            <span>{LANG_ICON[testLang]}</span>
            <span>{LANG_LABEL[testLang]}</span>
          </div>
          <p className="mt-2 text-sm text-white/90">Chọn 1 dạng bài để bắt đầu — mỗi lần vào lại sẽ ra bộ câu hỏi mới.</p>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {MODES.map((mode, i) => (
            <div
              key={mode.id}
              style={{ animationDelay: `${i * 70}ms` }}
              className="quiz-fade-in-up rounded-2xl border border-border bg-surface-2 px-5 py-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xl">
                  {mode.icon}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-ink">{mode.title}</div>
                  <div className="mt-0.5 text-xs text-ink-muted">{mode.desc}</div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Link
                  href={`/test/${testLang}/${mode.id}`}
                  className="flex-1 rounded-full bg-sky-500 px-3 py-2 text-center text-xs font-semibold text-white transition hover:bg-sky-600 hover:shadow-md active:scale-95"
                >
                  ▶ Bắt đầu
                </Link>
                <Link
                  href={`/test/${testLang}/${mode.id}?reflex=1`}
                  className="flex-1 rounded-full border border-sky-400 px-3 py-2 text-center text-xs font-semibold text-sky-600 transition hover:bg-sky-500/10 active:scale-95"
                >
                  ⚡ Phản xạ
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
