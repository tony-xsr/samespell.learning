"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Language } from "@/types/vocab";

interface WordResult {
  word: string;
  groupId: string;
  note: string;
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<WordResult[]>([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const words = splitWords(word);
    if (words.length === 0 || loading) return;
    setError(null);
    setResults([]);
    setLoading(true);

    const collected: WordResult[] = [];
    const errors: string[] = [];

    // Gửi TUẦN TỰ (không song song) — để từ thứ 2 trở đi có thể phát hiện nhóm đồng âm vừa được
    // tạo bởi từ ngay trước đó trong CÙNG lượt gửi này (server đọc lại dữ liệu mới nhất mỗi lần).
    for (const w of words) {
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "new-group", language: lang, word: w, existingReadings }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Không tạo được mindmap cho "${w}".`);
        collected.push({ word: w, groupId: data.group.id, note: data.note ?? `Đã xử lý "${w}".` });
      } catch (err) {
        errors.push(err instanceof Error ? err.message : `Có lỗi khi xử lý "${w}".`);
      }
    }

    setResults(collected);
    if (errors.length > 0) setError(errors.join(" "));
    setLoading(false);

    if (collected.length > 0) {
      setWord("");
      const uniqueGroupIds = new Set(collected.map((r) => r.groupId));
      if (uniqueGroupIds.size === 1) {
        // Cả (các) từ vừa nhập đều rơi vào cùng 1 nhóm — mở thẳng nhóm đó luôn, giống hành vi cũ.
        router.push(`/${lang}/${collected[0].groupId}`);
      }
      router.refresh();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 rounded-2xl border border-dashed border-accent-400 bg-surface-2 p-4"
    >
      <label className="text-sm font-semibold text-ink">✨ Tạo mindmap mới từ 1 hoặc nhiều từ</label>
      <p className="mt-1 text-xs text-ink-muted">
        Nhập 1 từ, hoặc nhiều từ cách nhau bằng dấu phẩy (vd 峰，风，疯) — AI sẽ tìm chữ gốc cho từng từ và
        sinh thêm từ liên quan. Nếu 2 từ có cùng cách đọc, hoặc trùng cách đọc với 1 nhóm đã có sẵn, hệ
        thống tự gộp chung vào 1 nhóm thay vì tạo nhóm trùng lặp.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="Ví dụ: 木头, 학교, 勉強 hoặc 峰，风，疯..."
          disabled={loading}
          className="flex-1 rounded-full border border-border bg-surface px-4 py-2 text-sm text-ink outline-none focus:border-brand-400 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !word.trim()}
          className="rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:brightness-105 disabled:opacity-50"
        >
          {loading ? "Đang tạo…" : "Tạo mindmap"}
        </button>
      </div>
      {results.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-ink-muted">
          {results.map((r, i) => (
            <li key={`${r.word}-${i}`}>
              <button
                type="button"
                onClick={() => router.push(`/${lang}/${r.groupId}`)}
                className="text-left text-brand-600 hover:underline"
              >
                {r.note}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
