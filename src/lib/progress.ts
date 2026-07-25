"use client";

import type { ProgressStore, SrsRating, WordProgress } from "@/types/vocab";

export async function loadProgress(): Promise<ProgressStore> {
  const res = await fetch("/api/progress");
  if (!res.ok) return {};
  const data = await res.json();
  return data.progress ?? {};
}

export async function rateWord(wordId: string, rating: SrsRating): Promise<WordProgress> {
  const res = await fetch("/api/progress/rate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wordId, rating }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Không lưu được tiến trình.");
  return data.progress;
}

export async function toggleBookmark(wordId: string): Promise<WordProgress> {
  const res = await fetch("/api/progress/bookmark", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wordId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Không lưu được yêu thích.");
  return data.progress;
}

export async function toggleMastered(wordId: string): Promise<WordProgress> {
  const res = await fetch("/api/progress/mastered", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wordId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Không lưu được trạng thái đã thuộc.");
  return data.progress;
}
