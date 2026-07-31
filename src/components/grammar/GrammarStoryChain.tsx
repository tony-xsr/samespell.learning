"use client";

import { useState } from "react";
import type { Language } from "@/types/vocab";
import type { ResolvedGrammarStory } from "@/lib/grammarStories";
import StoryNodeSentence from "@/components/grammar/StoryNodeSentence";

export default function GrammarStoryChain({ story, lang }: { story: ResolvedGrammarStory; lang: Language }) {
  // Ẩn nghĩa tiếng Việt mặc định — hiện cả câu gốc lẫn nghĩa cùng lúc thì không luyện được phản xạ
  // đọc-hiểu, chỉ nên xem nghĩa khi thực sự bí. Bấm để hiện, bấm lại để ẩn (không dùng chung 1 state
  // cho cả chuỗi vì mỗi câu người học có thể đoán được/không khác nhau).
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  function toggleReveal(id: string) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-surface-2 p-5 shadow-sm">
      <h2 className="font-semibold text-ink">{story.titleVn}</h2>
      <p className="mt-1 text-xs text-ink-muted">
        Cùng 1 mạch câu chuyện, mỗi bước dùng 1 điểm ngữ pháp khác nhau — bấm vào cấu trúc để xem chi
        tiết đầy đủ, bấm &ldquo;Xem nghĩa&rdquo; nếu chưa dịch được.
      </p>

      {/* overflow-x-auto CHỈ cuộn bên trong chuỗi này — nếu không thì chuỗi dài (nhiều bước) sẽ tràn
          ra ngoài và làm cuộn ngang CẢ TRANG, rất khó chịu khi có nhiều chuỗi xếp chồng lên nhau.
          Dải mờ bên phải (khi >3 bước, khả năng cao là tràn khung trên desktop) chỉ để gợi ý "còn
          nữa, cuộn tiếp đi" — không thì nhìn như bị cắt cụt/lỗi dù thực ra vẫn cuộn được bình thường. */}
      <div className="relative mt-4">
        <div className="overflow-x-auto">
          <div className="flex flex-col items-stretch gap-2 md:flex-row md:flex-nowrap md:items-center md:gap-3">
            {story.steps.map((step, i) => {
              const isRevealed = revealed.has(step.point.id);
              return (
                <div key={step.point.id} className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
                  <div className="shrink-0 rounded-xl border border-border bg-surface p-4 shadow-sm md:w-56">
                    <span className="inline-block rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                      {step.timeLabelVn}
                    </span>
                    <StoryNodeSentence
                      sentence={step.example.sentence}
                      lang={lang}
                      className="mt-2 text-base font-medium text-ink"
                    />
                    {isRevealed ? (
                      <p className="mt-1 text-sm text-ink-muted">{step.example.translationVn}</p>
                    ) : (
                      <button
                        onClick={() => toggleReveal(step.point.id)}
                        className="mt-1 text-xs font-medium text-brand-600 underline decoration-dotted hover:text-brand-700"
                      >
                        👁 Xem nghĩa
                      </button>
                    )}
                    {isRevealed && (
                      <button
                        onClick={() => toggleReveal(step.point.id)}
                        className="mt-0.5 block text-[11px] text-ink-muted underline decoration-dotted hover:text-ink"
                      >
                        Ẩn nghĩa
                      </button>
                    )}
                    <span className="mt-2 inline-block rounded-full border border-dashed border-brand-400 px-2 py-0.5 text-[11px] font-semibold text-brand-600">
                      {step.point.pattern}
                    </span>
                  </div>
                  {i < story.steps.length - 1 && (
                    <span className="shrink-0 self-center text-lg text-brand-400 md:rotate-0" aria-hidden>
                      <span className="md:hidden">↓</span>
                      <span className="hidden md:inline">→</span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {story.steps.length > 3 && (
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-10 bg-gradient-to-l from-surface-2 to-transparent md:block" />
        )}
      </div>
    </div>
  );
}
