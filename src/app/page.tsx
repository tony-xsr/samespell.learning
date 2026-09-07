import Link from "next/link";
import { getLanguages, wordCount } from "@/lib/vocabStore";

const LANG_ICON: Record<string, string> = { zh: "🇨🇳", ko: "🇰🇷", ja: "🇯🇵", en: "🇬🇧" };

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">{children}</p>
  );
}

export default async function Home() {
  const languages = await getLanguages();

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-md">
        <div className="rounded-3xl bg-gradient-to-br from-brand-600 to-accent-500 p-6 text-white shadow-lg">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">SameSpell Learning</h1>
          <p className="mt-2 text-sm text-white/90">
            Học <span className="font-semibold">4 ngôn ngữ</span> — Trung, Nhật, Hàn, Anh — cùng lúc
            qua các trục dễ nhầm: <span className="font-semibold">đồng âm, đồng dạng, sai nghĩa</span>.
            Từ ~200 chữ gốc, mở rộng ra hàng nghìn từ qua mindmap ngữ pháp/chủ đề, kịch bản hội thoại,
            và bài kiểm tra tự sinh không giới hạn.
          </p>
        </div>

        {/* Ôn tập & theo dõi tiến độ */}
        <div className="mt-6">
          <SectionLabel>Ôn tập &amp; theo dõi tiến độ</SectionLabel>

          <Link
            href="/review"
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-600 to-accent-500 px-5 py-3.5 text-sm font-semibold text-white shadow-md transition hover:brightness-105"
          >
            🎲 Ôn tập ngẫu nhiên tất cả ngôn ngữ
          </Link>

          <Link
            href="/test"
            className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-sky-400 px-5 py-3.5 text-sm font-semibold text-white shadow-md transition hover:brightness-105"
          >
            🧪 Kiểm tra kiến thức — trắc nghiệm, phản xạ, điền từ
          </Link>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <Link
              href="/my-vocab"
              className="flex flex-col items-center gap-1 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 px-3 py-3.5 text-center text-sm font-semibold text-white shadow-md transition hover:brightness-105"
            >
              <span className="text-lg">📚</span>
              Từ vựng của tôi
            </Link>
            <Link
              href="/stats"
              className="flex flex-col items-center gap-1 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 px-3 py-3.5 text-center text-sm font-semibold text-white shadow-md transition hover:brightness-105"
            >
              <span className="text-lg">📊</span>
              Thống kê học tập
            </Link>
          </div>
        </div>

        {/* Chọn ngôn ngữ */}
        <div className="mt-6">
          <SectionLabel>Chọn ngôn ngữ để học nhóm đồng âm</SectionLabel>
          <div className="flex flex-col gap-3">
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
                    href={disabled ? "#" : `/${lang.language}`}
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
                            {lang.groups.length} nhóm âm · {total} từ
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
                      href={`/${lang.language}/review`}
                      aria-label={`Luyện tập nhanh ${lang.label}`}
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

        {/* Trục nhầm lẫn mở rộng */}
        <div className="mt-6">
          <SectionLabel>Mở rộng trục nhầm lẫn</SectionLabel>
          <div className="flex flex-col gap-3">
            <Link
              href="/shapes"
              className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-accent-400 px-5 py-3 text-sm font-semibold text-accent-600 transition hover:bg-accent-500/5"
            >
              ✍️ Khám phá nhóm hình chữ (形近字) mới
            </Link>

            <Link
              href="/false-friends"
              className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-accent-400 px-5 py-3 text-sm font-semibold text-accent-600 transition hover:bg-accent-500/5"
            >
              🪤 Bẫy nghĩa (chung chữ, lệch nghĩa)
            </Link>

            <Link
              href="/initials"
              className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-accent-400 px-5 py-3 text-sm font-semibold text-accent-600 transition hover:bg-accent-500/5"
            >
              🔤 Cùng âm đầu pinyin
            </Link>
          </div>
        </div>

        {/* Mindmap & khám phá nâng cao */}
        <div className="mt-6">
          <SectionLabel>Mindmap &amp; khám phá nâng cao</SectionLabel>
          <div className="flex flex-col gap-3">
            <Link
              href="/grammar"
              className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-400 px-5 py-3 text-sm font-semibold text-brand-600 transition hover:bg-brand-500/5"
            >
              📘 Mindmap ngữ pháp (Hàn/Nhật)
            </Link>

            <Link
              href="/topics"
              className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald-400 px-5 py-3 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-500/5"
            >
              🧩 Mindmap theo chủ đề (thử nghiệm)
            </Link>

            <Link
              href="/scenarios"
              className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-rose-400 px-5 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-500/5"
            >
              🎬 Chuỗi kịch bản theo bối cảnh (thử nghiệm)
            </Link>
          </div>
        </div>

        {/* Liên kết từ vựng theo chữ Hán dùng chung */}
        <div className="mt-6">
          <SectionLabel>Liên kết từ vựng theo chữ Hán dùng chung (thử nghiệm)</SectionLabel>
          <div className="flex flex-col gap-2">
            <Link
              href="/chains"
              className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-amber-400 px-5 py-3 text-sm font-semibold text-amber-600 transition hover:bg-amber-500/5"
            >
              🔗 Nối đuôi — domino từ vựng
            </Link>

            <Link
              href="/synonyms"
              className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-amber-400 px-5 py-3 text-sm font-semibold text-amber-600 transition hover:bg-amber-500/5"
            >
              ⇕ Đồng nghĩa · trái nghĩa
            </Link>

            <Link
              href="/antonym-chars"
              className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-amber-400 px-5 py-3 text-sm font-semibold text-amber-600 transition hover:bg-amber-500/5"
            >
              ⇔ Cặp chữ trái nghĩa
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
