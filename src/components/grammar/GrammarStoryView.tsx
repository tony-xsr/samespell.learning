"use client";

import { useState } from "react";
import type { Language } from "@/types/vocab";
import type { ResolvedGrammarStory } from "@/lib/grammarStories";
import GrammarStoryChain from "@/components/grammar/GrammarStoryChain";
import GrammarStoryCanvas from "@/components/grammar/GrammarStoryCanvas";

type ViewMode = "list" | "canvas";

export default function GrammarStoryView({ story, lang }: { story: ResolvedGrammarStory; lang: Language }) {
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

      {mode === "list" ? <GrammarStoryChain story={story} lang={lang} /> : <GrammarStoryCanvas story={story} lang={lang} />}
    </div>
  );
}
