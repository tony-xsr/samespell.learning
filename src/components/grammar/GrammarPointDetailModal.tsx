import type { GrammarPoint } from "@/types/grammar";
import type { Language } from "@/types/vocab";
import type { GrammarExtras } from "@/lib/grammarExtras";
import StoryNodeSentence from "@/components/grammar/StoryNodeSentence";

/** Modal chi tiết 1 điểm ngữ pháp — dùng chung giữa mindmap canvas và canvas chuỗi ngữ cảnh, tránh
 * lặp lại JSX (nội dung + nút AI thêm ví dụ/mẹo nhớ) ở 2 nơi. */
export default function GrammarPointDetailModal({
  point,
  lang,
  colorText,
  extras,
  addingExampleId,
  addingMnemonicId,
  aiError,
  onAddExample,
  onAddMnemonic,
  onSpeak,
  onClose,
}: {
  point: GrammarPoint;
  lang: Language;
  colorText: string;
  extras: GrammarExtras;
  addingExampleId: string | null;
  addingMnemonicId: string | null;
  aiError: string | null;
  onAddExample: () => void;
  onAddMnemonic: () => void;
  onSpeak: (text: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl border border-border-strong bg-surface-2 p-5 text-left shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-bold text-ink">{point.pattern}</div>
            <div className={`mt-1 text-base font-semibold ${colorText}`}>{point.meaningVn}</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="shrink-0 rounded-full border border-border bg-surface-3 px-2.5 py-1 text-sm text-ink-muted hover:bg-surface"
          >
            ✕
          </button>
        </div>

        <p className="mt-3 text-sm text-ink">{point.formationRule}</p>
        <div className="mt-2 rounded-xl bg-surface-3/60 p-3 text-sm text-ink-muted">{point.nuanceVn}</div>

        {point.examples.map((ex, i) => (
          <div key={i} className="mt-2 rounded-xl bg-surface-3/60 p-3">
            <div className="flex items-start justify-between gap-2">
              <StoryNodeSentence sentence={ex.sentence} lang={lang} className="text-base text-ink" />
              <button
                onClick={() => onSpeak(ex.sentence)}
                aria-label="Đọc ví dụ"
                className="shrink-0 rounded-full border border-border bg-surface-2 px-2 py-1 text-sm hover:bg-surface"
              >
                🔊
              </button>
            </div>
            <div className="mt-1 text-sm text-ink-muted">{ex.translationVn}</div>
          </div>
        ))}

        {(extras.extraExamples[point.id] ?? []).map((ex, i) => (
          <div key={`extra-${i}`} className="mt-2 rounded-xl border border-dashed border-brand-300 bg-surface-3/40 p-3">
            <div className="flex items-start justify-between gap-2">
              <StoryNodeSentence sentence={ex.sentence} lang={lang} className="text-base text-ink" />
              <button
                onClick={() => onSpeak(ex.sentence)}
                aria-label="Đọc ví dụ"
                className="shrink-0 rounded-full border border-border bg-surface-2 px-2 py-1 text-sm hover:bg-surface"
              >
                🔊
              </button>
            </div>
            <div className="mt-1 text-sm text-ink-muted">{ex.translationVn}</div>
            <span className="mt-1 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
              ✨ AI bổ sung
            </span>
          </div>
        ))}

        <button
          onClick={onAddExample}
          disabled={addingExampleId === point.id}
          className="mt-2 text-xs font-medium text-brand-600 underline decoration-dotted hover:text-brand-700 disabled:opacity-50"
        >
          {addingExampleId === point.id ? "Đang tạo ví dụ…" : "✨ AI: thêm 1 ví dụ khác"}
        </button>

        {point.commonMistakeVn && (
          <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
            ⚠️ {point.commonMistakeVn}
          </div>
        )}
        <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          💡 {point.mnemonicVn}
        </div>
        {(extras.extraMnemonics[point.id] ?? []).map((tip, i) => (
          <div
            key={`extra-mnemonic-${i}`}
            className="mt-2 rounded-md border border-dashed border-brand-300 bg-amber-50/60 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/20 dark:text-amber-300"
          >
            💡 {tip}
            <span className="ml-2 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
              ✨ AI bổ sung
            </span>
          </div>
        ))}
        <button
          onClick={onAddMnemonic}
          disabled={addingMnemonicId === point.id}
          className="mt-2 text-xs font-medium text-brand-600 underline decoration-dotted hover:text-brand-700 disabled:opacity-50"
        >
          {addingMnemonicId === point.id ? "Đang nghĩ mẹo nhớ…" : "✨ AI: thêm 1 mẹo nhớ khác"}
        </button>

        {aiError && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
            {aiError}
          </p>
        )}
      </div>
    </div>
  );
}
