"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Language } from "@/types/vocab";

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = word.trim();
    if (!trimmed || loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "new-group", language: lang, word: trimmed, existingReadings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Không tạo được mindmap.");
      setWord("");
      router.push(`/${lang}/${data.group.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 rounded-2xl border border-dashed border-accent-400 bg-surface-2 p-4"
    >
      <label className="text-sm font-semibold text-ink">✨ Tạo mindmap mới từ 1 từ bất kỳ</label>
      <p className="mt-1 text-xs text-ink-muted">
        Nhập 1 từ, AI sẽ tìm chữ gốc và sinh thêm từ liên quan để tạo hẳn 1 nhóm mindmap mới — nhóm
        này cũng xuất hiện trong &ldquo;Luyện tập&rdquo; và có thể gộp vào data/ ở trang /admin.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="Ví dụ: 木头, 학교, 勉強..."
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
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
