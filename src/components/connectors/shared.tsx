"use client";

import { speak } from "@/lib/tts";
import type { ConnectorCategory, ConnectorEntry, ConnectorLanguage, ConnectorLanguageData } from "@/types/connector";

export type LangView = ConnectorLanguage | "both";

export const LANG_LABEL: Record<ConnectorLanguage, string> = { zh: "🇨🇳 Trung", ko: "🇰🇷 Hàn" };

export interface FlatEntry extends ConnectorEntry {
  language: ConnectorLanguage;
  categoryId: ConnectorCategory["id"];
  categoryIcon: string;
}

export function flatten(data: ConnectorLanguageData): FlatEntry[] {
  return data.categories.flatMap((c) =>
    c.entries.map((e) => ({ ...e, language: data.language, categoryId: c.id, categoryIcon: c.icon })),
  );
}

/** Đọc phần chữ của từ nối — bỏ ký hiệu "…", "-(으)", "A/B" để giọng đọc không vấp. */
export function speakable(form: string): string {
  return form
    .split(" / ")[0]
    .replace(/\(.*?\)/g, "")
    .replace(/[…\-]/g, " ")
    .split("/")[0]
    .trim();
}

export function SpeakButton({ text, language, className = "" }: { text: string; language: ConnectorLanguage; className?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        speak(text, language);
      }}
      className={`shrink-0 rounded-full border border-border bg-surface px-2 py-1 text-xs hover:bg-surface-2 ${className}`}
      aria-label="Nghe"
      title="Nghe"
    >
      🔊
    </button>
  );
}

/** Câu ví dụ với đoạn từ nối được tô đậm. */
export function Highlighted({ sentence, answer }: { sentence: string; answer: string }) {
  const i = sentence.indexOf(answer);
  if (i < 0 || !answer) return <>{sentence}</>;
  return (
    <>
      {sentence.slice(0, i)}
      <mark className="rounded bg-accent-500/20 px-0.5 font-semibold text-ink">{answer}</mark>
      {sentence.slice(i + answer.length)}
    </>
  );
}

export function registerClass(register: string): string {
  if (register.includes("viết")) return "bg-sky-500/10 text-sky-700 dark:text-sky-300";
  if (register.includes("khẩu")) return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return "bg-surface-3 text-ink-muted";
}

export function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const chipClass = (active: boolean) =>
  `whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
    active ? "bg-brand-600 text-white" : "border border-border bg-surface text-ink-muted hover:text-ink"
  }`;
