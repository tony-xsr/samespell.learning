/** Hiển thị 1 "answer-card" (theme 📖 Giải thích nhanh / 🀄 Chiết tự Hán) — kết quả PHẲNG, không phải
 * mindmap cây, xem Features.md mục 14.2 nhóm B. Dùng chung cho cả kết quả tức thời trong
 * NewGroupPrompt.tsx lẫn khi xem lại trong tab "Mới thêm" (MyVocabView.tsx). */
export default function AnswerCardView({ theme, card }: { theme: string; card: Record<string, string> }) {
  if (theme === "etymology") {
    return (
      <div className="space-y-1.5 text-sm">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-lg font-bold text-ink">{card.headword}</span>
          <span className="text-xs italic text-ink-muted">{card.reading}</span>
        </div>
        <div className="text-ink">
          <span className="font-semibold">Bộ thủ:</span> {card.radical} — {card.radicalMeaningVn}
        </div>
        <div className="text-ink">
          <span className="font-semibold">Thành phần khác:</span> {card.componentsVn}
        </div>
        <div className="text-ink-muted">{card.explanationVn}</div>
        {card.mnemonicVn && (
          <div className="rounded-md bg-amber-50 px-2.5 py-1.5 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            💡 {card.mnemonicVn}
          </div>
        )}
      </div>
    );
  }

  // Mặc định: "quick-dict"
  return (
    <div className="space-y-1.5 text-sm">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-lg font-bold text-ink">{card.headword}</span>
        <span className="text-xs italic text-ink-muted">{card.reading}</span>
        {card.wordClass && (
          <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] text-ink-muted">{card.wordClass}</span>
        )}
      </div>
      <div className="font-medium text-brand-600">{card.meaningVn}</div>
      <div className="rounded-md bg-surface-3/60 px-2.5 py-1.5">
        <div className="text-ink">{card.example}</div>
        <div className="mt-0.5 text-xs text-ink-muted">{card.exampleVn}</div>
      </div>
    </div>
  );
}
