import "server-only";
import type { Language } from "@/types/vocab";
import { kvGet, kvSet } from "@/lib/kv";

/** Lịch sử các từ người học đã mở chi tiết trong bảng Tra nhanh — nguồn cho "Ôn từ đã tra". Lưu server
 * (không chỉ localStorage) để tra trên điện thoại, ôn trên máy tính vẫn thấy; backup đầy đủ tự gồm key này. */
const KV_KEY = "lookup:history";
const MAX_ENTRIES = 300;

export interface LookupHistoryEntry {
  lang: Language;
  headword: string;
  at: number;
}

export async function loadLookupHistory(): Promise<LookupHistoryEntry[]> {
  return (await kvGet<LookupHistoryEntry[]>(KV_KEY)) ?? [];
}

/** Tra lại từ cũ thì đưa lên đầu, không nhân đôi. */
export async function recordLookup(lang: Language, headword: string): Promise<void> {
  const history = await loadLookupHistory();
  const next = [
    { lang, headword, at: Date.now() },
    ...history.filter((h) => !(h.lang === lang && h.headword === headword)),
  ].slice(0, MAX_ENTRIES);
  await kvSet(KV_KEY, next);
}
