import "server-only";
import type { Language } from "@/types/vocab";
import { kvGet, kvSet } from "@/lib/kv";
import { genId } from "@/lib/id";

/** "My New Vocab" — nhật ký MỌI lần người dùng tự gõ 1 từ vào ô "Tạo mindmap mới" (mode "new-group"
 * ở /api/generate) để AI giải thích, xem Features.md mục 14.3. Tách riêng khỏi vocabStore.ts (thay vì
 * đánh dấu source/createdAt ngay trên SoundGroup) vì mode "new-group" đôi khi chỉ gộp thêm 1 root vào
 * 1 group ĐÃ CÓ SẴN (kể cả group soạn sẵn) thay vì luôn tạo group mới — 1 nhật ký riêng ghi đúng "người
 * dùng đã tự tra từ gì, khi nào" mà không cần đụng vào logic merge phức tạp của vocabStore. */

const KV_KEY = "vocab:new-log";
const MAX_ENTRIES = 300;

export interface NewVocabEntry {
  id: string;
  language: Language;
  /** Theme AI đã dùng: "sound" (mặc định, mindmap đồng âm), "polyphonic", "synonym-family" (cả 3 ra
   * 1 SoundGroup, xem `groupId`), hoặc "quick-dict"/"etymology" (ra 1 answer-card phẳng, xem `card`
   * — nội dung answer-card lưu TRỰC TIẾP tại đây, không có store riêng vì chỉ dùng để hiển thị lại
   * trong tab "Mới thêm", chưa hỗ trợ favorite/danh mục cho answer-card, xem Features.md mục 14.2). */
  theme: string;
  word: string;
  note: string;
  createdAt: string;
  groupId?: string;
  card?: Record<string, string>;
}

export async function loadNewVocabLog(): Promise<NewVocabEntry[]> {
  try {
    const data = await kvGet<NewVocabEntry[]>(KV_KEY);
    return data ?? [];
  } catch {
    return [];
  }
}

export async function logNewVocabEntry(entry: {
  language: Language;
  theme: string;
  word: string;
  note: string;
  groupId?: string;
  card?: Record<string, string>;
}): Promise<void> {
  try {
    const log = await loadNewVocabLog();
    const next: NewVocabEntry = { ...entry, id: genId("newvocab"), createdAt: new Date().toISOString() };
    const updated = [next, ...log].slice(0, MAX_ENTRIES);
    await kvSet(KV_KEY, updated);
  } catch {
    // KV chưa cấu hình — bỏ qua, không chặn luồng tạo mindmap chính.
  }
}
