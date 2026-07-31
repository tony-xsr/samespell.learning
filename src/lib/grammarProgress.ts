"use client";

import type { ProgressStore, SrsRating, WordProgress } from "@/types/vocab";

export async function loadGrammarProgress(): Promise<ProgressStore> {
  const res = await fetch("/api/grammar-progress");
  if (!res.ok) return {};
  const data = await res.json();
  return data.progress ?? {};
}

export async function rateGrammarCard(cardId: string, rating: SrsRating): Promise<WordProgress> {
  const res = await fetch("/api/grammar-progress/rate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cardId, rating }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Không lưu được tiến trình.");
  return data.progress;
}

export async function toggleGrammarBookmark(cardId: string): Promise<WordProgress> {
  const res = await fetch("/api/grammar-progress/bookmark", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cardId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Không lưu được yêu thích.");
  return data.progress;
}

export async function toggleGrammarMastered(cardId: string): Promise<WordProgress> {
  const res = await fetch("/api/grammar-progress/mastered", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cardId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Không lưu được trạng thái đã thuộc.");
  return data.progress;
}
