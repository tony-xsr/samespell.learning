"use client";

import type { FlatEntry } from "@/components/connectors/shared";
import { Highlighted, registerClass, SpeakButton, speakable } from "@/components/connectors/shared";

/** Thẻ 1 từ nối: dòng gọn (chữ, cách đọc, nghĩa) → bấm mở ra khung câu, sắc thái, ví dụ có tô đậm, mẹo nhớ. */
export default function ConnectorCard({
  entry,
  open,
  onToggle,
  compact = false,
}: {
  entry: FlatEntry;
  open: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  return (
    <div
      id={`c-${entry.id}`}
      className={`scroll-mt-24 rounded-2xl border bg-surface transition ${open ? "border-brand-400 shadow-sm" : "border-border"}`}
    >
      <div className="flex items-start gap-2 p-3">
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left" aria-expanded={open}>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className={`font-bold text-ink ${compact ? "text-base" : "text-lg"}`}>{entry.form}</span>
            <span className="text-xs text-ink-muted">{entry.reading}</span>
          </div>
          {entry.hanViet && <div className="text-[11px] font-semibold uppercase tracking-wide text-accent-600">{entry.hanViet}</div>}
          <div className={`text-ink ${compact ? "text-xs" : "text-sm"}`}>{entry.meaningVn}</div>
        </button>
        <SpeakButton text={speakable(entry.form)} language={entry.language} />
      </div>

      {open && (
        <div className="space-y-3 border-t border-border px-3 pb-3 pt-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-lg bg-surface-2 px-2 py-1 text-xs text-ink">{entry.usage}</code>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${registerClass(entry.register)}`}>{entry.register}</span>
            {entry.hanja && (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-muted">Hanja {entry.hanja.replace(/_/g, "·")}</span>
            )}
          </div>
          <p className="text-ink-muted">{entry.nuanceVn}</p>
          <ul className="space-y-2">
            {entry.examples.map((ex) => (
              <li key={ex.sentence} className="flex items-start gap-2 rounded-xl bg-surface-2 p-2">
                <div className="min-w-0 flex-1">
                  <div className="text-ink">
                    <Highlighted sentence={ex.sentence} answer={ex.answer} />
                  </div>
                  <div className="text-xs text-ink-muted">{ex.translationVn}</div>
                </div>
                <SpeakButton text={ex.sentence} language={entry.language} />
              </li>
            ))}
          </ul>
          <p className="rounded-xl border border-dashed border-accent-400 bg-accent-500/5 p-2 text-ink">💡 {entry.mnemonicVn}</p>
        </div>
      )}
    </div>
  );
}
