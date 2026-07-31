import "server-only";
import type { GrammarExample } from "@/types/grammar";
import { kvGet, kvSet } from "@/lib/kv";

/** Nội dung ngữ pháp do AI bổ sung THÊM (ví dụ/mẹo nhớ) trên nền dữ liệu đã soạn tay sẵn — tách
 * riêng khỏi `data/*-grammar.json` (giống cách vocab tách `vocab:extra:{lang}` khỏi `data/*.json`)
 * để không lẫn giữa nội dung đã kiểm chứng thủ công và nội dung AI sinh thêm. */
export interface GrammarExtras {
  extraExamples: Record<string, GrammarExample[]>;
  extraMnemonics: Record<string, string[]>;
}

function kvKey(lang: string): string {
  return `grammar:extra:${lang}`;
}

function emptyExtras(): GrammarExtras {
  return { extraExamples: {}, extraMnemonics: {} };
}

export async function loadGrammarExtras(lang: string): Promise<GrammarExtras> {
  try {
    return (await kvGet<GrammarExtras>(kvKey(lang))) ?? emptyExtras();
  } catch {
    return emptyExtras();
  }
}

export async function addGrammarExtraExample(
  lang: string,
  pointId: string,
  example: GrammarExample,
): Promise<GrammarExample[]> {
  const extras = await loadGrammarExtras(lang);
  const list = [...(extras.extraExamples[pointId] ?? []), example];
  extras.extraExamples[pointId] = list;
  await kvSet(kvKey(lang), extras);
  return list;
}

export async function addGrammarExtraMnemonic(
  lang: string,
  pointId: string,
  tip: string,
): Promise<string[]> {
  const extras = await loadGrammarExtras(lang);
  const list = [...(extras.extraMnemonics[pointId] ?? []), tip];
  extras.extraMnemonics[pointId] = list;
  await kvSet(kvKey(lang), extras);
  return list;
}
