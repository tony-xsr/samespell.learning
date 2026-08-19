import "server-only";
import type { ProgressStore, WordProgress } from "@/types/vocab";
import { kvGet, kvSet } from "@/lib/kv";
import { defaultProgress } from "@/lib/srs";

/** Trạng thái "đã thuộc" cho CHUỖI KỊCH BẢN (`/scenarios`) — dùng lại `WordProgress`/`ProgressStore` từ
 * `srs.ts` như `grammarProgressStore.ts` đã làm cho ngữ pháp, nhưng lưu ở Redis key RIÊNG
 * (`progress:scenario`) để tránh id chuỗi kịch bản va chạm với id từ vựng/ngữ pháp. Chỉ dùng trường
 * `mastered` (đánh dấu đã thuộc) — chuỗi kịch bản không phải thẻ ôn tập giãn cách nên không cần
 * `interval`/`ease`/`dueAt`/`rating`. Key dùng ở đây là `ScenarioEntry.id`. */
const KV_KEY = "progress:scenario";

export async function loadScenarioProgressStore(): Promise<ProgressStore> {
  try {
    return (await kvGet<ProgressStore>(KV_KEY)) ?? {};
  } catch {
    return {};
  }
}

export async function toggleScenarioLearnedServer(scenarioId: string): Promise<WordProgress> {
  const store = await loadScenarioProgressStore();
  const current = store[scenarioId] ?? defaultProgress();
  const updated: WordProgress = { ...current, mastered: !current.mastered };
  store[scenarioId] = updated;
  await kvSet(KV_KEY, store);
  return updated;
}
