"use client";

import { useEffect, useMemo, useState } from "react";
import type { Language } from "@/types/vocab";
import { speak } from "@/lib/tts";
import { LEVEL_SCALE, levelClass, levelRank } from "@/lib/levels";
import type { MatchItem } from "@/components/mindmap/MeaningMatchGame";

/** Xem toàn bộ nội dung mindmap dưới dạng bảng — mindmap tốt cho việc thấy quan hệ, nhưng khi muốn
 * rà lại hay tra nhanh một từ thì một danh sách dọc dễ quét mắt hơn nhiều. */
export default function MindmapWordList({
  items,
  language,
  title,
  onClose,
}: {
  items: MatchItem[];
  language: Language;
  title: string;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("");
  const [hideMeaning, setHideMeaning] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /** Chỉ hiện bộ lọc trình độ khi mindmap này THỰC SỰ có nhãn — phần lớn nội dung soạn sẵn chưa gắn,
   * bày ra một dropdown rỗng chỉ làm người dùng tưởng hỏng. */
  const presentLevels = useMemo(() => {
    const set = new Set(items.map((i) => i.level).filter((l): l is string => !!l));
    return LEVEL_SCALE[language].values.filter((v) => set.has(v));
  }, [items, language]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return items.filter((i) => {
      if (level && i.level !== level) return false;
      if (!n) return true;
      return [i.headword, i.reading, i.meaningVn, i.hanViet, i.wordClass].some((f) =>
        f?.toLowerCase().includes(n),
      );
    });
  }, [items, q, level]);

  const wordCount = items.filter((i) => !i.isRoot).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Danh sách từ"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-border bg-surface p-4 shadow-xl sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-ink sm:text-xl">📖 {title}</h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              {items.length - wordCount} chữ gốc · {wordCount} từ
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="shrink-0 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-sm text-ink-muted hover:bg-surface-3"
          >
            ✕
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="🔍 Lọc trong mindmap này…"
            aria-label="Lọc từ trong danh sách"
            className="min-w-0 flex-1 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-sm text-ink placeholder:text-ink-muted focus:border-brand-400 focus:outline-none"
          />
          {presentLevels.length > 0 && (
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              aria-label="Lọc theo trình độ"
              className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs text-ink focus:border-brand-400 focus:outline-none"
            >
              <option value="">Mọi trình độ</option>
              {presentLevels.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => {
              setHideMeaning((h) => !h);
              setRevealed(new Set());
            }}
            aria-pressed={hideMeaning}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              hideMeaning
                ? "border-amber-400 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                : "border-border bg-surface-2 text-ink hover:bg-surface-3"
            }`}
          >
            {hideMeaning ? "👁 Hiện nghĩa" : "🙈 Ẩn nghĩa"}
          </button>
        </div>

        <div className="mt-3 max-h-[60vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-muted">Không có từ nào khớp.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {filtered.map((i) => (
                <li
                  key={i.id}
                  className={`rounded-xl border px-3 py-2 ${
                    i.isRoot
                      ? "border-brand-200 bg-brand-50/60 dark:border-brand-900 dark:bg-brand-950/25"
                      : "border-border bg-surface-2"
                  }`}
                >
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <button
                      type="button"
                      onClick={() => void speak(i.headword, language)}
                      aria-label={`Đọc ${i.headword}`}
                      className={`font-semibold text-ink hover:underline ${i.isRoot ? "text-base" : "text-sm"}`}
                    >
                      {i.headword}
                    </button>
                    {i.reading && <span className="text-xs italic text-ink-muted">{i.reading}</span>}
                    {i.hanViet && i.hanViet !== i.reading && (
                      <span className="text-xs text-ink-muted">({i.hanViet})</span>
                    )}
                    {i.wordClass && (
                      <span className="text-xs italic text-ink-muted">{i.wordClass}</span>
                    )}
                    {levelRank(language, i.level) >= 0 && (
                      <span className={`rounded-full px-1.5 text-[10px] font-bold ${levelClass(language, i.level)}`}>
                        {i.level}
                      </span>
                    )}
                    {i.userAdded && (
                      <span className="rounded-full bg-violet-100 px-1.5 text-[10px] font-bold text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                        ✚ TỰ THÊM
                      </span>
                    )}
                    {i.isRoot && (
                      <span className="rounded-full bg-brand-100 px-1.5 text-[10px] font-bold text-brand-700 dark:bg-brand-900/50 dark:text-brand-300">
                        GỐC
                      </span>
                    )}
                  </div>

                  {hideMeaning && !revealed.has(i.id) ? (
                    <button
                      type="button"
                      aria-label={`Hiện nghĩa của ${i.headword}`}
                      onClick={() => setRevealed((s) => new Set(s).add(i.id))}
                      className="mt-0.5 rounded bg-surface-3 px-2 text-sm text-ink-muted hover:bg-surface"
                    >
                      • • •
                    </button>
                  ) : (
                    <p className="mt-0.5 text-sm text-accent-600">{i.meaningVn}</p>
                  )}

                  {i.example && <p className="mt-0.5 text-xs text-ink-muted">{i.example}</p>}

                  {/* Mẹo nhớ: giấu khi đang che nghĩa, vì mẹo thường nói thẳng nghĩa ra. */}
                  {i.mnemonicVn && (!hideMeaning || revealed.has(i.id)) && (
                    <p className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                      💡 {i.mnemonicVn}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
