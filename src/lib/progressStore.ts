import "server-only";
import type { ProgressStore, SrsRating, WordProgress } from "@/types/vocab";
import { kvGet, kvSet } from "@/lib/kv";
import { applyRating, defaultProgress } from "@/lib/srs";

const KV_KEY = "progress:main";

export async function loadProgressStore(): Promise<ProgressStore> {
  try {
    return (await kvGet<ProgressStore>(KV_KEY)) ?? {};
  } catch {
    return {};
  }
}

export async function rateWordServer(wordId: string, rating: SrsRating): Promise<WordProgress> {
  const store = await loadProgressStore();
  const current = store[wordId] ?? defaultProgress();
  const updated = applyRating(current, rating);
  store[wordId] = updated;
  await kvSet(KV_KEY, store);
  return updated;
}

export async function toggleBookmarkServer(wordId: string): Promise<WordProgress> {
  const store = await loadProgressStore();
  const current = store[wordId] ?? defaultProgress();
  const updated: WordProgress = { ...current, bookmarked: !current.bookmarked };
  store[wordId] = updated;
  await kvSet(KV_KEY, store);
  return updated;
}
