"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Language } from "@/types/vocab";
import AnswerCardView from "@/components/AnswerCardView";

/** Theme "kind: group" → API trả về { group, note }, điều hướng tới trang mindmap.
 * Theme "kind: card" → API trả về { card }, hiển thị NGAY tại đây, không điều hướng. */
const HAN_LANGS: Language[] = ["zh", "ko", "ja"];

const THEMES = [
  { key: "sound", label: "🔊 Đồng âm", kind: "group" as const, langs: HAN_LANGS },
  { key: "polyphonic", label: "🌗 Đa âm Hán Việt", kind: "group" as const, langs: HAN_LANGS },
  { key: "synonym-family", label: "🔗 Họ hàng nghĩa/Đồng-trái nghĩa", kind: "group" as const, langs: HAN_LANGS },
  { key: "word-family", label: "🌳 Từ cùng gốc (Latin/Hy Lạp)", kind: "group" as const, langs: ["en"] as Language[] },
  { key: "quick-dict", label: "📖 Giải thích nhanh", kind: "card" as const },
  { key: "etymology", label: "🀄 Chiết tự Hán", kind: "card" as const, langs: ["zh", "ja"] as Language[] },
];

const THEME_STORAGE_KEY = "samespell:ai-theme";

interface WordResult {
  word: string;
  note: string;
  groupId?: string;
  card?: Record<string, string>;
  cardTheme?: string;
}

/** Tách chuỗi nhập thành nhiều từ nếu người dùng gõ nhiều từ cách nhau bằng dấu phẩy (thường hoặc
 * kiểu Trung/Nhật), dấu gạch chéo, hoặc xuống dòng — vd "峰，风，疯" → ["峰", "风", "疯"]. */
function splitWords(input: string): string[] {
  return input
    .split(/[,，、/\n]+/)
    .map((w) => w.trim())
    .filter(Boolean);
}

export default function NewGroupPrompt({
  lang,
  existingReadings,
}: {
  lang: Language;
  existingReadings: string[];
}) {
  const router = useRouter();
  const [word, setWord] = useState("");
  const availableThemes = THEMES.filter((t) => !t.langs || t.langs.includes(lang));
  const [theme, setTheme] = useState(() => availableThemes[0]?.key ?? "sound");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<WordResult[]>([]);

  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved && THEMES.some((t) => t.key === saved && (!t.langs || t.langs.includes(lang)))) {
      setTheme(saved);
    }
  }, [lang]);

  function selectTheme(key: string) {
    setTheme(key);
    window.localStorage.setItem(THEME_STORAGE_KEY, key);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const words = splitWords(word);
    if (words.length === 0 || loading) return;
    setError(null);
    setResults([]);
    setLoading(true);

    const selected = availableThemes.find((t) => t.key === theme) ?? THEMES[0];
    const collected: WordResult[] = [];
    const errors: string[] = [];

    // Gửi TUẦN TỰ (không song song) — để từ thứ 2 trở đi có thể phát hiện nhóm đồng âm vừa được
    // tạo bởi từ ngay trước đó trong CÙNG lượt gửi này (server đọc lại dữ liệu mới nhất mỗi lần).
    for (const w of words) {
      try {
        const body =
          selected.kind === "group"
            ? { mode: "new-group", language: lang, word: w, existingReadings, theme: selected.key }
            : { mode: selected.key === "etymology" ? "etymology" : "quick-explain", language: lang, word: w };
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Không xử lý được "${w}".`);
        if (selected.kind === "group") {
          collected.push({ word: w, groupId: data.group.id, note: data.note ?? `Đã xử lý "${w}".` });
        } else {
          collected.push({ word: w, note: `Đã xử lý "${w}".`, card: data.card, cardTheme: selected.key });
        }
      } catch (err) {
        errors.push(err instanceof Error ? err.message : `Có lỗi khi xử lý "${w}".`);
      }
    }

    setResults(collected);
    if (errors.length > 0) setError(errors.join(" "));
    setLoading(false);

    if (collected.length > 0) {
      setWord("");
      if (selected.kind === "group") {
        const uniqueGroupIds = new Set(collected.map((r) => r.groupId));
        if (uniqueGroupIds.size === 1) {
          // Cả (các) từ vừa nhập đều rơi vào cùng 1 nhóm — mở thẳng nhóm đó luôn, giống hành vi cũ.
          router.push(`/${lang}/${collected[0].groupId}`);
        }
      }
      router.refresh();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 rounded-2xl border border-dashed border-accent-400 bg-surface-2 p-4"
    >
      <label className="text-sm font-semibold text-ink">✨ Hỏi AI / Tạo mindmap mới</label>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {availableThemes.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => selectTheme(t.key)}
            disabled={loading}
            className={`rounded-full px-3 py-1 text-xs font-medium transition disabled:opacity-50 ${
              theme === t.key
                ? "bg-gradient-to-r from-brand-600 to-accent-500 text-white shadow-sm"
                : "border border-border bg-surface text-ink-muted hover:bg-surface-3"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="mt-2 text-xs text-ink-muted">
        Nhập 1 từ, hoặc nhiều từ cách nhau bằng dấu phẩy (vd {lang === "en" ? "extract, attract" : "峰，风，疯"})
        — AI sẽ xử lý theo kiểu đã chọn ở trên.
        {theme === "sound" &&
          " Với kiểu 🔊 Đồng âm: nếu 2 từ trùng cách đọc, hoặc trùng với 1 nhóm đã có sẵn, hệ thống tự gộp chung vào 1 nhóm thay vì tạo nhóm trùng lặp."}
      </p>

      <div className="mt-3 flex gap-2">
        <input
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder={lang === "en" ? "Ví dụ: extract, portable, inspect..." : "Ví dụ: 木头, 학교, 勉強 hoặc 峰，风，疯..."}
          disabled={loading}
          className="flex-1 rounded-full border border-border bg-surface px-4 py-2 text-sm text-ink outline-none focus:border-brand-400 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !word.trim()}
          className="rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:brightness-105 disabled:opacity-50"
        >
          {loading ? "Đang tạo…" : "Gửi"}
        </button>
      </div>

      {results.length > 0 && (
        <div className="mt-3 space-y-2">
          {results.map((r, i) =>
            r.card ? (
              <div key={`${r.word}-${i}`} className="rounded-xl border border-border bg-surface p-3">
                <AnswerCardView theme={r.cardTheme ?? "quick-dict"} card={r.card} />
              </div>
            ) : (
              <button
                key={`${r.word}-${i}`}
                type="button"
                onClick={() => router.push(`/${lang}/${r.groupId}`)}
                className="block text-left text-xs text-brand-600 hover:underline"
              >
                {r.note}
              </button>
            ),
          )}
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
