"use client";

import type { GrammarPoint } from "@/types/grammar";
import type { Language } from "@/types/vocab";
import { speak } from "@/lib/tts";
import { useFurigana } from "@/lib/useFurigana";

/** Câu/pattern tiếng Nhật kèm furigana (nếu có kanji) — tái dùng đúng hook đã có ở `StoryNodeSentence`,
 * viết riêng ở đây vì cần className/kích cỡ chữ khác (chữ nhỏ hơn để vừa ô lưới). */
function FuriganaText({ text, lang, className }: { text: string; lang: Language; className: string }) {
  const furigana = useFurigana(text, lang);
  if (furigana) {
    return (
      <span
        className={`${className} [&_rt]:text-[8px] [&_rt]:font-normal [&_rt]:text-ink-muted`}
        dangerouslySetInnerHTML={{ __html: furigana }}
      />
    );
  }
  return <span className={className}>{text}</span>;
}

function SpeakButton({ text, lang }: { text: string; lang: Language }) {
  return (
    <button
      onClick={() => speak(text, lang)}
      aria-label="Đọc to"
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-[10px] hover:bg-surface-3"
    >
      🔊
    </button>
  );
}

/** 1 ô trong lưới thời gian (Trục B) — mỗi điểm ngữ pháp trong ô có nút 🔊 đọc to (pattern + câu ví dụ)
 * và furigana cho phần tiếng Nhật (câu ví dụ luôn hiện furigana nếu có kanji; pattern cũng vậy — nhiều
 * pattern như "た形"/"辞書形/普通形" có kanji, không phải thuần kana). Người dùng phản hồi lưới thời
 * gian không có cách nghe phát âm cũng không có gì hỗ trợ đọc chữ Hán trong tiếng Nhật. */
export default function GrammarTimelineCell({ points, lang }: { points: GrammarPoint[]; lang: Language }) {
  if (points.length === 0) {
    return <div className="flex min-h-[88px] items-center justify-center text-xs text-ink-muted/50">—</div>;
  }
  return (
    <div className="flex min-h-[88px] flex-col gap-1.5 p-1.5">
      {points.map((p) => (
        <div key={p.id} className="rounded-lg border border-border bg-surface-2 px-2 py-1.5">
          <div className="flex items-center gap-1.5">
            <FuriganaText text={p.pattern} lang={lang} className="text-sm font-bold leading-relaxed text-brand-600" />
            <SpeakButton text={p.pattern} lang={lang} />
          </div>
          <div className="text-xs text-ink-muted">{p.meaningVn}</div>
          {p.examples[0] && (
            <div className="mt-1 flex items-start gap-1.5 text-xs">
              <div className="flex-1">
                <FuriganaText text={p.examples[0].sentence} lang={lang} className="leading-relaxed text-ink" />
                <div className="text-ink-muted">{p.examples[0].translationVn}</div>
              </div>
              <SpeakButton text={p.examples[0].sentence} lang={lang} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
