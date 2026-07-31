"use client";

import { useState } from "react";
import type { Language } from "@/types/vocab";
import type { ResolvedGrammarBranchingStory } from "@/lib/grammarStories";
import GrammarBranchingStoryChain from "@/components/grammar/GrammarBranchingStoryChain";
import GrammarBranchingStoryCanvas from "@/components/grammar/GrammarBranchingStoryCanvas";

type ViewMode = "list" | "canvas";

export default function GrammarBranchingStoryView({
  story,
  lang,
}: {
  story: ResolvedGrammarBranchingStory;
  lang: Language;
}) {
  const [mode, setMode] = useState<ViewMode>("canvas");

  return (
    <div className="min-w-0">
      <div className="mb-2 flex justify-end gap-1">
        <button
          onClick={() => setMode("list")}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            mode === "list" ? "bg-brand-600 text-white" : "border border-border bg-surface-2 text-ink-muted"
          }`}
        >
          📋 Danh sách
        </button>
        <button
          onClick={() => setMode("canvas")}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            mode === "canvas" ? "bg-brand-600 text-white" : "border border-border bg-surface-2 text-ink-muted"
          }`}
        >
          🗺️ Canvas
        </button>
      </div>

      {mode === "list" ? (
        <GrammarBranchingStoryChain story={story} lang={lang} />
      ) : (
        <GrammarBranchingStoryCanvas story={story} lang={lang} />
      )}
    </div>
  );
}
