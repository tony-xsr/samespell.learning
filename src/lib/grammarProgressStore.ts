import "server-only";
import type { ProgressStore, SrsRating, WordProgress } from "@/types/vocab";
import { kvGet, kvSet } from "@/lib/kv";
import { applyRating, defaultProgress } from "@/lib/srs";
import { localDateKey } from "@/lib/dateKey";
import { computeReviewStats, type ReviewStats } from "@/lib/progressStore";

/** SRS cho NGỮ PHÁP — dùng lại nguyên vẹn `WordProgress`/`ProgressStore`/`applyRating`/`isDue` từ
 * `srs.ts` (thuật toán không phụ thuộc gì vào từ vựng, chỉ nhận 1 id chuỗi bất kỳ) nhưng lưu ở
 * Redis key RIÊNG (`progress:grammar`), không dùng chung `progress:main` với từ vựng — tránh id ngữ
 * pháp/từ vựng va chạm và tránh làm lẫn số liệu thống kê (heatmap/overdue) của 2 hệ thống khác nhau.
 * Key dùng ở đây là `GrammarPoint.id` (thẻ chuẩn) hoặc `confusion:<groupId>` (thẻ trắc nghiệm). */
const KV_KEY = "progress:grammar";
const HISTORY_KEY = "progress:grammar:history";

export async function loadGrammarProgressStore(): Promise<ProgressStore> {
  try {
    return (await kvGet<ProgressStore>(KV_KEY)) ?? {};
  } catch {
    return {};
  }
}

async function logGrammarReviewEvent(): Promise<void> {
  const history = (await kvGet<Record<string, number>>(HISTORY_KEY)) ?? {};
  const key = localDateKey();
  history[key] = (history[key] ?? 0) + 1;
  await kvSet(HISTORY_KEY, history);
}

export async function rateGrammarCardServer(cardId: string, rating: SrsRating): Promise<WordProgress> {
  const store = await loadGrammarProgressStore();
  const current = store[cardId] ?? defaultProgress();
  const updated = applyRating(current, rating);
  store[cardId] = updated;
  await Promise.all([kvSet(KV_KEY, store), logGrammarReviewEvent()]);
  return updated;
}

export async function toggleGrammarBookmarkServer(cardId: string): Promise<WordProgress> {
  const store = await loadGrammarProgressStore();
  const current = store[cardId] ?? defaultProgress();
  const updated: WordProgress = { ...current, bookmarked: !current.bookmarked };
  store[cardId] = updated;
  await kvSet(KV_KEY, store);
  return updated;
}

export async function toggleGrammarMasteredServer(cardId: string): Promise<WordProgress> {
  const store = await loadGrammarProgressStore();
  const current = store[cardId] ?? defaultProgress();
  const updated: WordProgress = { ...current, mastered: !current.mastered };
  store[cardId] = updated;
  await kvSet(KV_KEY, store);
  return updated;
}

export async function getGrammarReviewStats(): Promise<ReviewStats> {
  const [store, history] = await Promise.all([
    loadGrammarProgressStore(),
    kvGet<Record<string, number>>(HISTORY_KEY),
  ]);
  return computeReviewStats(store, history);
}
