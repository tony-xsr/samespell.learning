import { useEffect, useState } from "react";
import type { Language } from "@/types/vocab";

const cache = new Map<string, string>();

/** Trả về HTML furigana (<ruby>/<rt>) cho 1 câu tiếng Nhật, lấy qua API route (tính toán PHẢI chạy
 * ở server — xem ghi chú trong src/lib/jaFurigana.ts) và cache lại trong phiên (nhiều component có
 * thể cùng hỏi furigana của 1 câu ví dụ — mindmap, story canvas, modal chi tiết — nên cache theo câu
 * để không gọi API lại). Trả về "" khi không phải tiếng Nhật, câu rỗng, hoặc đang tải/tính (furigana
 * sẽ xuất hiện ngay khi xong, câu gốc vẫn đọc được bình thường trong lúc chờ). */
export function useFurigana(text: string, lang: Language): string {
  const [html, setHtml] = useState<string>(() => (lang === "ja" ? cache.get(text) ?? "" : ""));

  useEffect(() => {
    if (lang !== "ja" || !text) {
      setHtml("");
      return;
    }
    const cached = cache.get(text);
    if (cached !== undefined) {
      setHtml(cached);
      return;
    }
    let cancelled = false;
    fetch("/api/grammar/furigana", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
      .then((r) => (r.ok ? r.json() : { html: "" }))
      .then((data: { html?: string }) => {
        const result = data.html ?? "";
        cache.set(text, result);
        if (!cancelled) setHtml(result);
      })
      .catch(() => {
        if (!cancelled) setHtml("");
      });
    return () => {
      cancelled = true;
    };
  }, [text, lang]);

  return html;
}
