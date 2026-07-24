import type { SrsRating, WordProgress } from "@/types/vocab";

const MIN_EASE = 1.3;
const DEFAULT_EASE = 2.5;

export function defaultProgress(): WordProgress {
  return { interval: 1, ease: DEFAULT_EASE, dueAt: new Date().toISOString(), reviewCount: 0 };
}

export function applyRating(progress: WordProgress, rating: SrsRating): WordProgress {
  const oldEase = progress.ease;
  let interval = progress.interval;
  let ease = oldEase;

  switch (rating) {
    case 0: // Again
      interval = 1;
      ease = oldEase - 0.2;
      break;
    case 1: // Hard
      interval = Math.ceil(interval * 1.2);
      ease = oldEase - 0.15;
      break;
    case 2: { // Good
      interval = Math.round(interval * oldEase);
      break;
    }
    case 3: { // Easy
      const goodInterval = Math.round(progress.interval * oldEase);
      interval = Math.max(goodInterval + 1, Math.round(progress.interval * oldEase * 1.3));
      break;
    }
  }

  ease = Math.max(MIN_EASE, ease);
  interval = Math.max(1, interval);

  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + interval);

  return {
    interval,
    ease,
    dueAt: dueAt.toISOString(),
    reviewCount: progress.reviewCount + 1,
    lastRating: rating,
    bookmarked: progress.bookmarked,
    mastered: progress.mastered,
  };
}

export function isDue(progress: WordProgress | undefined): boolean {
  if (!progress) return true;
  return new Date(progress.dueAt).getTime() <= Date.now();
}

export const RATING_LABELS: Record<SrsRating, string> = {
  0: "Quên rồi",
  1: "Khó",
  2: "Ổn",
  3: "Dễ",
};
