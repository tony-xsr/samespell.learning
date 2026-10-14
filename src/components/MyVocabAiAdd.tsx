"use client";

import { useState } from "react";
import type { Language } from "@/types/vocab";
import NewGroupPrompt from "@/components/NewGroupPrompt";

const LANG_OPTIONS: { value: Language; label: string }[] = [
  { value: "en", label: "🇺🇸 Tiếng Anh" },
  { value: "zh", label: "🇨🇳 Tiếng Trung" },
  { value: "ko", label: "🇰🇷 Tiếng Hàn" },
  { value: "ja", label: "🇯🇵 Tiếng Nhật" },
];

/** Ô "thêm từ vựng bằng AI" ngay trên trang "Từ vựng của tôi" — trước đây chỉ có ở trang từng ngôn ngữ
 * (/en, /zh...). Chọn ngôn ngữ ở đây rồi tái dùng nguyên `NewGroupPrompt` (theme + ô nhập + kết quả). */
export default function MyVocabAiAdd({
  readingsByLang,
  prefill,
}: {
  readingsByLang: Partial<Record<Language, string[]>>;
  /** Từ chưa có trong kho, chuyển sang từ bảng Tra nhanh — điền sẵn ngôn ngữ + ô nhập. */
  prefill?: { text: string; lang: Language };
}) {
  const [lang, setLang] = useState<Language>(prefill?.lang ?? "en");

  return (
    <div className="rounded-2xl border border-border bg-surface-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-ink">✨ Thêm / phân tích từ vựng bằng AI</span>
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as Language)}
          className="ml-auto rounded-full border border-border bg-surface px-3 py-1 text-sm text-ink outline-none focus:border-brand-400"
        >
          {LANG_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        Nhập từ, chọn kiểu phân tích (theme) bên dưới — AI tạo mindmap/thẻ và lưu vào tab &ldquo;✨ Mới thêm&rdquo;.
      </p>

      {/* key={lang} → remount khi đổi ngôn ngữ để reset theme cho phù hợp (vd tiếng Anh không có "Đồng âm"). */}
      <NewGroupPrompt
        key={lang}
        lang={lang}
        existingReadings={readingsByLang[lang] ?? []}
        initialWord={prefill?.lang === lang ? prefill.text : undefined}
      />
    </div>
  );
}
