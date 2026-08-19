"use client";

import type { ProgressStore, WordProgress } from "@/types/vocab";

export async function loadScenarioProgress(): Promise<ProgressStore> {
  const res = await fetch("/api/scenario-progress");
  if (!res.ok) return {};
  const data = await res.json();
  return data.progress ?? {};
}

export async function toggleScenarioLearned(scenarioId: string): Promise<WordProgress> {
  const res = await fetch("/api/scenario-progress/learned", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenarioId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Không lưu được trạng thái đã thuộc.");
  return data.progress;
}
