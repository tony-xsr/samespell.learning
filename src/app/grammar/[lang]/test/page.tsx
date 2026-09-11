import Link from "next/link";
import { notFound } from "next/navigation";
import { getGrammarData } from "@/lib/grammarStore";

const MODES = [
  {
    id: "meaning",
    icon: "🧠",
    title: "Trắc nghiệm nghĩa",
    desc: "Nhìn cấu trúc, chọn đúng nghĩa tiếng Việt",
  },
  {
    id: "usage",
    icon: "⚡",
    title: "Trắc nghiệm cách dùng",
    desc: "Nhìn câu ví dụ (kèm nghĩa), chọn đúng cấu trúc đang được minh hoạ",
  },
] as const;

export default async function GrammarTestModePicker({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const data = getGrammarData(lang);
  if (!data) notFound();

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-md">
        <Link href={`/grammar/${lang}`} className="text-sm font-medium text-brand-600 hover:underline">
          ← {data.label}
        </Link>

        <div className="quiz-fade-in-up mt-3 rounded-3xl bg-gradient-to-br from-sky-600 to-sky-400 p-6 text-white shadow-lg">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">🧪 Trắc nghiệm ngữ pháp</h1>
          <p className="mt-2 text-sm text-white/90">
            Chọn 1 dạng bài để bắt đầu — mỗi lần vào lại sẽ ra bộ câu hỏi mới, ưu tiên nhiễu từ các cụm
            cấu trúc dễ nhầm nếu có.
          </p>
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
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                <Link
                  href={`/grammar/${lang}/test/${mode.id}`}
                  className="rounded-full bg-sky-500 px-2 py-2 text-center text-xs font-semibold text-white transition hover:bg-sky-600 hover:shadow-md active:scale-95"
                >
                  ▶ Bắt đầu
                </Link>
                <Link
                  href={`/grammar/${lang}/test/${mode.id}?reflex=1`}
                  className="rounded-full border border-sky-400 px-2 py-2 text-center text-xs font-semibold text-sky-600 transition hover:bg-sky-500/10 active:scale-95"
                >
                  ⚡ Phản xạ
                </Link>
                <Link
                  href={`/grammar/${lang}/test/${mode.id}?explain=1`}
                  className="rounded-full border border-amber-400 px-2 py-2 text-center text-xs font-semibold text-amber-600 transition hover:bg-amber-500/10 active:scale-95"
                >
                  📖 Giải thích
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
