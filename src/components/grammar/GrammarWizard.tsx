"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ResolvedWizardNode, ResolvedWizardLeaf } from "@/lib/grammarWizard";
import type { Language } from "@/types/vocab";
import StoryNodeSentence from "@/components/grammar/StoryNodeSentence";

function isLeaf(node: ResolvedWizardNode | ResolvedWizardLeaf): node is ResolvedWizardLeaf {
  return node.kind === "leaf";
}

function LeafResult({ leaf, lang, onReset }: { leaf: ResolvedWizardLeaf; lang: string; onReset: () => void }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-2 p-5">
      <p className="text-sm text-ink-muted">{leaf.label}</p>
      {leaf.point ? (
        <div className="mt-3 rounded-xl border border-brand-300 bg-surface p-4">
          <span className="text-xl font-bold text-brand-600">{leaf.point.pattern}</span>
          <p className="mt-1 text-sm font-medium text-ink">{leaf.point.meaningVn}</p>
          <p className="mt-2 rounded-xl bg-surface-3 p-2.5 text-xs text-ink">{leaf.point.nuanceVn}</p>
          {leaf.point.examples[0] && (
            <div className="mt-2 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs">
              <StoryNodeSentence
                sentence={leaf.point.examples[0].sentence}
                lang={lang as Language}
                className="font-medium text-ink"
              />
              <div className="text-ink-muted">{leaf.point.examples[0].translationVn}</div>
            </div>
          )}
          {leaf.point.confusionGroupId && (
            <Link
              href={`/grammar/${lang}/confusion#${leaf.point.confusionGroupId}`}
              className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-accent-500/10 px-2.5 py-1 text-xs font-medium text-accent-600 hover:bg-accent-500/20"
            >
              ⚡ Xem cụm dễ nhầm liên quan
            </Link>
          )}
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-border bg-surface p-4 text-sm text-ink-muted">
          Ngôn ngữ này chưa có cấu trúc tương ứng trong Trục A.
        </p>
      )}
      {leaf.crossLangNote && (
        <p className="mt-3 text-xs italic text-accent-600">💡 {leaf.crossLangNote}</p>
      )}
      <button
        type="button"
        onClick={onReset}
        className="mt-4 rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:brightness-105"
      >
        🔄 Bắt đầu lại
      </button>
    </div>
  );
}

export default function GrammarWizard({ root, lang }: { root: ResolvedWizardNode; lang: string }) {
  const [path, setPath] = useState<string[]>([]);

  const { current, breadcrumb } = useMemo(() => {
    let node: ResolvedWizardNode = root;
    const crumbs: string[] = [];
    for (const step of path) {
      const next = node.children.find((c) => c.id === step);
      if (!next || isLeaf(next)) break;
      node = next;
      crumbs.push(next.question);
    }
    return { current: node, breadcrumb: crumbs };
  }, [root, path]);

  const lastStepId = path[path.length - 1];
  const selectedLeaf = useMemo(() => {
    if (!lastStepId) return undefined;
    const found = current.children.find((c) => c.id === lastStepId);
    return found && isLeaf(found) ? found : undefined;
  }, [current, lastStepId]);

  function choose(childId: string) {
    setPath((prev) => [...prev, childId]);
  }

  function reset() {
    setPath([]);
  }

  function goBack() {
    setPath((prev) => prev.slice(0, -1));
  }

  return (
    <div className="rounded-2xl border border-dashed border-accent-400 p-5">
      {breadcrumb.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1 text-xs text-ink-muted">
          <button type="button" onClick={reset} className="hover:underline">
            Bắt đầu
          </button>
          {breadcrumb.map((b, i) => (
            <span key={i}>
              <span className="mx-1">›</span>
              {b}
            </span>
          ))}
        </div>
      )}

      {selectedLeaf ? (
        <LeafResult leaf={selectedLeaf} lang={lang} onReset={reset} />
      ) : (
        <>
          <h2 className="text-base font-bold text-ink">{current.question}</h2>
          <div className="mt-3 flex flex-col gap-2">
            {current.children.map((child) => (
              <button
                key={child.id}
                type="button"
                onClick={() => choose(child.id)}
                className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-left text-sm text-ink transition hover:border-brand-300 hover:bg-surface-3"
              >
                {isLeaf(child) ? child.label : child.question}
              </button>
            ))}
          </div>
          {path.length > 0 && (
            <button
              type="button"
              onClick={goBack}
              className="mt-3 text-xs font-medium text-brand-600 hover:underline"
            >
              ← Quay lại
            </button>
          )}
        </>
      )}
    </div>
  );
}
