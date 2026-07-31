"use client";

import { useEffect, useState } from "react";
import type { GrammarPoint } from "@/types/grammar";
import type { GrammarExtras } from "@/lib/grammarExtras";

/** Dùng chung giữa mọi canvas/UI ngữ pháp (mindmap, chuỗi ngữ cảnh...) cần nút AI "thêm ví dụ/mẹo
 * nhớ" — tránh lặp lại y hệt logic fetch/gọi AI ở từng component. */
export function useGrammarExtras(lang: string) {
  const [extras, setExtras] = useState<GrammarExtras>({ extraExamples: {}, extraMnemonics: {} });
  const [addingExampleId, setAddingExampleId] = useState<string | null>(null);
  const [addingMnemonicId, setAddingMnemonicId] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/grammar/extra?lang=${lang}`)
      .then((r) => r.json())
      .then((data) =>
        setExtras({ extraExamples: data.extraExamples ?? {}, extraMnemonics: data.extraMnemonics ?? {} }),
      )
      .catch(() => {});
  }, [lang]);

  async function addExample(point: GrammarPoint) {
    setAiError(null);
    setAddingExampleId(point.id);
    try {
      const res = await fetch("/api/grammar/extra-example", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: lang,
          pointId: point.id,
          pattern: point.pattern,
          meaningVn: point.meaningVn,
          nuanceVn: point.nuanceVn,
          existingSentences: [
            ...point.examples.map((e) => e.sentence),
            ...(extras.extraExamples[point.id] ?? []).map((e) => e.sentence),
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lỗi khi gọi AI");
      setExtras((ex) => ({ ...ex, extraExamples: { ...ex.extraExamples, [point.id]: data.examples } }));
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setAddingExampleId(null);
    }
  }

  async function addMnemonic(point: GrammarPoint) {
    setAiError(null);
    setAddingMnemonicId(point.id);
    try {
      const res = await fetch("/api/grammar/extra-mnemonic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: lang,
          pointId: point.id,
          pattern: point.pattern,
          meaningVn: point.meaningVn,
          nuanceVn: point.nuanceVn,
          existingTips: [point.mnemonicVn, ...(extras.extraMnemonics[point.id] ?? [])],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lỗi khi gọi AI");
      setExtras((ex) => ({ ...ex, extraMnemonics: { ...ex.extraMnemonics, [point.id]: data.mnemonics } }));
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setAddingMnemonicId(null);
    }
  }

  return { extras, addingExampleId, addingMnemonicId, aiError, addExample, addMnemonic };
}
