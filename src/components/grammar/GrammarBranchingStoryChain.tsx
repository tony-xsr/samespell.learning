"use client";

import { useState } from "react";
import type { Language } from "@/types/vocab";
import type { ResolvedGrammarBranchingStory } from "@/lib/grammarStories";
import StoryNodeSentence from "@/components/grammar/StoryNodeSentence";

const BRANCH_STYLE = [
  "border-green-400 bg-green-50 dark:bg-green-950/20",
  "border-red-400 bg-red-50 dark:bg-red-950/20",
  "border-blue-400 bg-blue-50 dark:bg-blue-950/20",
];

export default function GrammarBranchingStoryChain({
  story,
  lang,
}: {
  story: ResolvedGrammarBranchingStory;
  lang: Language;
}) {
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
      <h2 className="font-semibold text-ink">🌳 {story.titleVn}</h2>
      <p className="mt-1 text-xs text-ink-muted">
        Mở đầu chung, rồi rẽ thành các phản hồi khác nhau — mỗi nhánh minh hoạ 1 cấu trúc riêng.
      </p>

      <div className="mt-4 overflow-x-auto">
        <div className="flex flex-col items-stretch gap-2 md:flex-row md:flex-nowrap md:items-center md:gap-3">
          {story.trunk.map((step) => {
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
                  <span className="mt-2 inline-block rounded-full border border-dashed border-brand-400 px-2 py-0.5 text-[11px] font-semibold text-brand-600">
                    {step.point.pattern}
                  </span>
                </div>
                <span className="shrink-0 self-center text-lg text-brand-400" aria-hidden>
                  <span className="md:hidden">↓</span>
                  <span className="hidden md:inline">→</span>
                </span>
              </div>
            );
          })}

          <div className="flex flex-col gap-2 md:flex-row md:flex-nowrap">
            {story.branches.map((branch, i) => {
              const isRevealed = revealed.has(branch.point.id);
              return (
                <div
                  key={branch.point.id}
                  className={`shrink-0 rounded-xl border-2 p-4 shadow-sm md:w-56 ${BRANCH_STYLE[i % BRANCH_STYLE.length]}`}
                >
                  <span className="inline-block rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-ink">
                    {branch.labelVn}
                  </span>
                  <StoryNodeSentence
                    sentence={branch.example.sentence}
                    lang={lang}
                    className="mt-2 text-base font-medium text-ink"
                  />
                  {isRevealed ? (
                    <p className="mt-1 text-sm text-ink-muted">{branch.example.translationVn}</p>
                  ) : (
                    <button
                      onClick={() => toggleReveal(branch.point.id)}
                      className="mt-1 text-xs font-medium text-brand-600 underline decoration-dotted hover:text-brand-700"
                    >
                      👁 Xem nghĩa
                    </button>
                  )}
                  <span className="mt-2 inline-block rounded-full border border-dashed border-brand-400 px-2 py-0.5 text-[11px] font-semibold text-brand-600">
                    {branch.point.pattern}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
