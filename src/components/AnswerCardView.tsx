/** Hiển thị 1 "answer-card" (theme 📖 Giải thích nhanh / 🀄 Chiết tự Hán / 🧠 Giải thích sâu & mẹo nhớ /
 * 📝 Thêm ví dụ / 🔗 Từ đồng nghĩa / 🧩 Cụm từ đi cùng) — kết quả PHẲNG, không phải mindmap cây, xem
 * Features.md mục 14.2 nhóm B. Dùng chung cho cả kết quả tức thời trong NewGroupPrompt.tsx lẫn khi xem
 * lại trong tab "Mới thêm" (MyVocabView.tsx). Các theme có mảng (examples/synonyms/collocations) lưu
 * mảng đó dưới dạng JSON-string trong 1 field của `card` (vì NewVocabEntry.card là Record<string,string>)
 * — parse lại ở đây khi hiển thị. */
export default function AnswerCardView({ theme, card }: { theme: string; card: Record<string, string> }) {
  const headwordLine = (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="text-lg font-bold text-ink">{card.headword}</span>
      <span className="text-xs italic text-ink-muted">{card.reading}</span>
    </div>
  );

  if (theme === "explain-mnemonic") {
    return (
      <div className="space-y-1.5 text-sm">
        {headwordLine}
        <div className="font-medium text-brand-600">{card.meaningVn}</div>
        <div className="text-ink">{card.explanationVn}</div>
        {card.mnemonicVn && (
          <div className="rounded-md bg-amber-50 px-2.5 py-1.5 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            💡 {card.mnemonicVn}
          </div>
        )}
      </div>
    );
  }

  if (theme === "examples") {
    let examples: { sentence: string; translationVn: string; contextVn?: string }[] = [];
    try {
      examples = JSON.parse(card.examplesJson ?? "[]");
    } catch {
      examples = [];
    }
    return (
      <div className="space-y-1.5 text-sm">
        {headwordLine}
        <div className="font-medium text-brand-600">{card.meaningVn}</div>
        <div className="space-y-1.5">
          {examples.map((ex, i) => (
            <div key={i} className="rounded-md bg-surface-3/60 px-2.5 py-1.5">
              {ex.contextVn && <div className="text-[11px] uppercase tracking-wide text-ink-muted">{ex.contextVn}</div>}
              <div className="text-ink">{ex.sentence}</div>
              <div className="mt-0.5 text-xs text-ink-muted">{ex.translationVn}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (theme === "synonyms") {
    let synonyms: { word: string; reading: string; nuanceVn: string }[] = [];
    try {
      synonyms = JSON.parse(card.synonymsJson ?? "[]");
    } catch {
      synonyms = [];
    }
    return (
      <div className="space-y-1.5 text-sm">
        {headwordLine}
        <div className="font-medium text-brand-600">{card.meaningVn}</div>
        <div className="space-y-1.5">
          {synonyms.map((s, i) => (
            <div key={i} className="rounded-md bg-surface-3/60 px-2.5 py-1.5">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-semibold text-ink">{s.word}</span>
                <span className="text-xs italic text-ink-muted">{s.reading}</span>
              </div>
              <div className="mt-0.5 text-xs text-ink-muted">{s.nuanceVn}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (theme === "collocations") {
    let collocations: { phrase: string; meaningVn: string }[] = [];
    try {
      collocations = JSON.parse(card.collocationsJson ?? "[]");
    } catch {
      collocations = [];
    }
    return (
      <div className="space-y-1.5 text-sm">
        {headwordLine}
        <div className="font-medium text-brand-600">{card.meaningVn}</div>
        <div className="space-y-1.5">
          {collocations.map((c, i) => (
            <div key={i} className="rounded-md bg-surface-3/60 px-2.5 py-1.5">
              <span className="font-semibold text-ink">{c.phrase}</span>
              <span className="ml-2 text-xs text-ink-muted">{c.meaningVn}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

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
