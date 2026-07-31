import "server-only";
import type { ProgressStore, SrsRating, WordProgress } from "@/types/vocab";
import { kvGet, kvSet } from "@/lib/kv";
import { applyRating, defaultProgress } from "@/lib/srs";
import { localDateKey } from "@/lib/dateKey";

const KV_KEY = "progress:main";
const HISTORY_KEY = "progress:history";

export async function loadProgressStore(): Promise<ProgressStore> {
  try {
    return (await kvGet<ProgressStore>(KV_KEY)) ?? {};
  } catch {
    return {};
  }
}

/** Đếm số thẻ đã chấm điểm theo từng ngày (yyyy-mm-dd) — dùng để vẽ heatmap lịch sử ôn luyện.
 * Chỉ log khi thực sự chấm điểm (rateWordServer), không log khi bookmark/mastered vì đó không
 * phải hoạt động "ôn tập". */
async function logReviewEvent(): Promise<void> {
  const history = (await kvGet<Record<string, number>>(HISTORY_KEY)) ?? {};
  const key = localDateKey();
  history[key] = (history[key] ?? 0) + 1;
  await kvSet(HISTORY_KEY, history);
}

export async function rateWordServer(wordId: string, rating: SrsRating): Promise<WordProgress> {
  const store = await loadProgressStore();
  const current = store[wordId] ?? defaultProgress();
  const updated = applyRating(current, rating);
  store[wordId] = updated;
  await Promise.all([kvSet(KV_KEY, store), logReviewEvent()]);
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

export async function toggleMasteredServer(wordId: string): Promise<WordProgress> {
  const store = await loadProgressStore();
  const current = store[wordId] ?? defaultProgress();
  const updated: WordProgress = { ...current, mastered: !current.mastered };
  store[wordId] = updated;
  await kvSet(KV_KEY, store);
  return updated;
}

export interface ReviewStats {
  /** Số thẻ đã ôn theo từng ngày (yyyy-mm-dd), dùng vẽ heatmap. */
  history: Record<string, number>;
  /** Số thẻ sẽ đến hạn theo từng ngày sắp tới (yyyy-mm-dd), không tính thẻ đã mastered. */
  upcoming: Record<string, number>;
  /** Số thẻ đã quá hạn (dueAt ở quá khứ) tính đến hiện tại. */
  overdue: number;
  masteredCount: number;
  totalTracked: number;
}

/** Tính `ReviewStats` từ 1 `ProgressStore` + lịch sử ôn tập bất kỳ — dùng chung cho cả từ vựng
 * (`progress:main`) và ngữ pháp (`progress:grammar`, xem `grammarProgressStore.ts`) để không lặp lại
 * logic gộp overdue/upcoming/mastered ở 2 nơi. */
export function computeReviewStats(
  store: ProgressStore,
  history: Record<string, number> | null,
): ReviewStats {
  const upcoming: Record<string, number> = {};
  let overdue = 0;
  let masteredCount = 0;
  const now = Date.now();

  for (const progress of Object.values(store)) {
    if (progress.mastered) {
      masteredCount += 1;
      continue;
    }
    const dueTime = new Date(progress.dueAt).getTime();
    if (dueTime <= now) {
      overdue += 1;
    } else {
      const key = localDateKey(new Date(dueTime));
      upcoming[key] = (upcoming[key] ?? 0) + 1;
    }
  }

  return {
    history: history ?? {},
    upcoming,
    overdue,
    masteredCount,
    totalTracked: Object.keys(store).length,
  };
}

export async function getReviewStats(): Promise<ReviewStats> {
  const [store, history] = await Promise.all([
    loadProgressStore(),
    kvGet<Record<string, number>>(HISTORY_KEY),
  ]);
  return computeReviewStats(store, history);
}
