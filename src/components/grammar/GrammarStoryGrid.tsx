"use client";

import { useState } from "react";
import type { Language } from "@/types/vocab";
import type { ResolvedGrammarBranchingStory, ResolvedGrammarStory } from "@/lib/grammarStories";
import GrammarStoryView from "@/components/grammar/GrammarStoryView";
import GrammarBranchingStoryView from "@/components/grammar/GrammarBranchingStoryView";

type CardData =
  | { kind: "linear"; story: ResolvedGrammarStory }
  | { kind: "branching"; story: ResolvedGrammarBranchingStory };

/** Hiển thị dạng LƯỚI THẺ nhẹ (chỉ tiêu đề + số bước) thay vì render sẵn TOÀN BỘ canvas của mọi
 * chuỗi cùng lúc — nếu nhiều chuỗi mà mount hết canvas (mỗi canvas có state zoom/pan/TTS/fetch extras
 * riêng) cùng lúc sẽ rất nặng và rối UI. Bấm vào thẻ mới thực sự mount 1 canvas duy nhất, hiện trong
 * popup toàn màn hình (đóng lại thì unmount, giải phóng tài nguyên). */
export default function GrammarStoryGrid({
  stories,
  branchingStories,
  lang,
}: {
  stories: ResolvedGrammarStory[];
  branchingStories: ResolvedGrammarBranchingStory[];
  lang: Language;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const cards: CardData[] = [
    ...branchingStories.map((story): CardData => ({ kind: "branching", story })),
    ...stories.map((story): CardData => ({ kind: "linear", story })),
  ];

  const open = openIndex !== null ? cards[openIndex] : null;

  return (
    <>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {cards.map((card, i) => (
          <button
            key={card.story.id}
            onClick={() => setOpenIndex(i)}
            className="rounded-2xl border border-border bg-surface-2 p-4 text-left shadow-sm hover:border-brand-300 hover:shadow-md"
          >
            <div className="flex items-center gap-2 font-semibold text-ink">
              <span>{card.kind === "branching" ? "🌳" : "🔗"}</span>
              {card.story.titleVn}
            </div>
            <div className="mt-1 text-xs text-ink-muted">
              {card.kind === "branching"
                ? `${card.story.trunk.length} bước mở đầu · ${card.story.branches.length} nhánh phản hồi`
                : `${card.story.steps.length} bước`}
            </div>
          </button>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-surface">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-semibold text-ink">
              {open.kind === "branching" ? "🌳" : "🔗"} {open.story.titleVn}
            </h2>
            <button
              onClick={() => setOpenIndex(null)}
              className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-sm font-semibold text-ink hover:bg-surface-3"
            >
              ✕ Đóng
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {open.kind === "branching" ? (
              <GrammarBranchingStoryView story={open.story} lang={lang} />
            ) : (
              <GrammarStoryView story={open.story} lang={lang} />
            )}
          </div>
        </div>
      )}
    </>
  );
}
