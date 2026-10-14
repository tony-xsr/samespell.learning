import "server-only";
import { kvGet, kvSet } from "@/lib/kv";

/** Tiến độ luyện viết theo TỪNG CHỮ (không theo từ): cùng một chữ xuất hiện trong nhiều từ, viết đúng ở
 * đâu cũng là nhớ được chữ đó. Lưu 1 key duy nhất — backup đầy đủ (lib/backup.ts) tự quét mọi key nên
 * không cần khai báo thêm. */
const KV_KEY = "writing:progress";

export type WritingAttemptMode = "trace" | "recall";

export interface CharWritingStat {
  /** Số lần viết xong chữ (tô + nhớ). */
  attempts: number;
  /** Số lần viết theo trí nhớ, và số lần trong đó không sai nét nào. */
  recallAttempts: number;
  recallPerfect: number;
  /** Số nét sai ở lần viết gần nhất (bất kể chế độ). */
  lastMistakes: number;
  lastMode: WritingAttemptMode;
  lastAt: number;
  /** Số lần LIÊN TIẾP gần nhất viết theo trí nhớ không sai nét — sai 1 lần là về 0. */
  recallStreak: number;
}

export type WritingProgress = Record<string, CharWritingStat>;

/** Thuộc chữ = viết theo trí nhớ không sai nét 2 lần liên tiếp. */
export const MASTERED_STREAK = 2;

export async function loadWritingProgress(): Promise<WritingProgress> {
  return (await kvGet<WritingProgress>(KV_KEY)) ?? {};
}

export async function recordWritingAttempt(
  char: string,
  mistakes: number,
  mode: WritingAttemptMode,
): Promise<CharWritingStat> {
  const store = await loadWritingProgress();
  const prev: CharWritingStat = store[char] ?? {
    attempts: 0,
    recallAttempts: 0,
    recallPerfect: 0,
    lastMistakes: 0,
    lastMode: mode,
    lastAt: 0,
    recallStreak: 0,
  };
  const perfect = mistakes === 0;
  const next: CharWritingStat = {
    attempts: prev.attempts + 1,
    recallAttempts: prev.recallAttempts + (mode === "recall" ? 1 : 0),
    recallPerfect: prev.recallPerfect + (mode === "recall" && perfect ? 1 : 0),
    lastMistakes: mistakes,
    lastMode: mode,
    lastAt: Date.now(),
    // Tô theo mẫu không làm tăng chuỗi "thuộc" (có nét mờ dẫn đường), nhưng sai thì vẫn mất chuỗi
    recallStreak: mode === "recall" ? (perfect ? prev.recallStreak + 1 : 0) : perfect ? prev.recallStreak : 0,
  };
  store[char] = next;
  await kvSet(KV_KEY, store);
  return next;
}

export function isMastered(stat: CharWritingStat | undefined): boolean {
  return !!stat && stat.recallStreak >= MASTERED_STREAK;
}

/** Chữ cần luyện lại: lần gần nhất còn sai nét, chưa thuộc. Nhiều nét sai + mới sai gần đây lên trước. */
export function weakChars(progress: WritingProgress): string[] {
  return Object.entries(progress)
    .filter(([, s]) => s.lastMistakes > 0 && !isMastered(s))
    .sort(([, a], [, b]) => b.lastMistakes - a.lastMistakes || b.lastAt - a.lastAt)
    .map(([c]) => c);
}

export interface WritingSummary {
  practiced: number;
  mastered: number;
  weak: number;
}

export function summarizeWriting(progress: WritingProgress): WritingSummary {
  const stats = Object.values(progress);
  return {
    practiced: stats.length,
    mastered: stats.filter(isMastered).length,
    weak: weakChars(progress).length,
  };
}
