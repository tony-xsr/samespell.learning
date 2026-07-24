import "server-only";
import type { Language } from "@/types/vocab";
import { kvGet, kvSet } from "@/lib/kv";

function kvKey(lang: Language): string {
  return `mnemonic:${lang}`;
}

export async function getMnemonicMap(lang: Language): Promise<Record<string, string>> {
  try {
    return (await kvGet<Record<string, string>>(kvKey(lang))) ?? {};
  } catch {
    return {};
  }
}

export async function setMnemonic(lang: Language, wordId: string, text: string): Promise<void> {
  const map = await getMnemonicMap(lang);
  map[wordId] = text;
  await kvSet(kvKey(lang), map);
}
