/** Hiển thị 1 "answer-card" (theme 📖 Giải thích nhanh / 🀄 Chiết tự Hán / 🧠 Giải thích sâu & mẹo nhớ /
 * 📝 Thêm ví dụ / 🔗 Từ đồng nghĩa / 🧩 Cụm từ đi cùng / 🏮 Phân tích thành ngữ / ✂️ Mổ xẻ câu) — kết quả
 * PHẲNG, không phải mindmap cây, xem
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

  if (theme === "idiom") {
    let breakdown: { part: string; reading: string; meaningVn: string }[] = [];
    try {
      breakdown = JSON.parse(card.breakdownJson ?? "[]");
    } catch {
      breakdown = [];
    }
    return (
      <div className="space-y-1.5 text-sm">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-lg font-bold text-ink">{card.headword}</span>
          <span className="text-xs italic text-ink-muted">{card.reading}</span>
          {card.hanViet && <span className="text-xs text-ink-muted">({card.hanViet})</span>}
          <span className="max-w-full break-words rounded-full bg-surface-3 px-2 py-0.5 text-[11px] text-ink-muted">
            {card.wordClass || "thành ngữ"}
          </span>
        </div>
        {/* Nghĩa dùng thật đứng trước, mặt chữ đứng sau và nhạt hơn — thành ngữ khó chính vì hai thứ
            này lệch nhau, gộp lại một dòng là mất hết giá trị. */}
        <div className="font-medium text-brand-600">{card.meaningVn}</div>
        {card.literalVn && (
          <div className="text-xs text-ink-muted">
            <span className="font-semibold">Mặt chữ:</span> {card.literalVn}
          </div>
        )}
        {breakdown.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {breakdown.map((b, i) => (
              <div key={i} className="rounded-md bg-surface-3/60 px-2 py-1">
                <div className="flex items-baseline gap-1">
                  <span className="font-semibold text-ink">{b.part}</span>
                  <span className="text-[10px] italic text-ink-muted">{b.reading}</span>
                </div>
                <div className="text-[11px] text-ink-muted">{b.meaningVn}</div>
              </div>
            ))}
          </div>
        )}
        {card.originVn && (
          <div className="text-ink">
            <span className="font-semibold">Điển tích:</span> {card.originVn}
          </div>
        )}
        {card.usageVn && (
          <div className="text-ink-muted">
            <span className="font-semibold text-ink">Dùng khi:</span> {card.usageVn}
          </div>
        )}
        {card.example && (
          <div className="rounded-md bg-surface-3/60 px-2.5 py-1.5">
            <div className="text-ink">{card.example}</div>
            <div className="mt-0.5 text-xs text-ink-muted">{card.exampleVn}</div>
          </div>
        )}
      </div>
    );
  }

  if (theme === "sentence") {
    let chunks: { text: string; reading: string; meaningVn: string; roleVn: string }[] = [];
    try {
      chunks = JSON.parse(card.chunksJson ?? "[]");
    } catch {
      chunks = [];
    }
    return (
      <div className="space-y-1.5 text-sm">
        <div className="text-base font-bold text-ink">{card.sentence}</div>
        <div className="text-xs italic text-ink-muted">{card.reading}</div>
        <div className="font-medium text-brand-600">{card.translationVn}</div>
        {chunks.length > 0 && (
          <ol className="space-y-1">
            {chunks.map((c, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-2 rounded-md bg-surface-3/60 px-2.5 py-1.5">
                <span className="font-semibold text-ink">{c.text}</span>
                <span className="text-[11px] italic text-ink-muted">{c.reading}</span>
                <span className="text-xs text-ink">{c.meaningVn}</span>
                <span className="max-w-full break-words rounded-full bg-surface px-1.5 py-0.5 text-[10px] text-ink-muted">{c.roleVn}</span>
              </li>
            ))}
          </ol>
        )}
        {card.grammarVn && (
          <div className="text-ink">
            <span className="font-semibold">Cấu trúc:</span> {card.grammarVn}
          </div>
        )}
        {card.noteVn && (
          <div className="rounded-md bg-amber-50 px-2.5 py-1.5 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            💡 {card.noteVn}
          </div>
        )}
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
          <span className="max-w-full break-words rounded-full bg-surface-3 px-2 py-0.5 text-[11px] text-ink-muted">{card.wordClass}</span>
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
