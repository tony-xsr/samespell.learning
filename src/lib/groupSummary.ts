import type { Language, SoundGroup } from "@/types/vocab";
import { LEVEL_SCALE } from "@/lib/levels";
import { flattenWords } from "@/lib/wordTree";

/** "Mới" = mindmap được thêm vào kho trong ngần này ngày. Xem `SoundGroup.addedAt` (Features.md mục 22). */
export const NEW_WINDOW_DAYS = 30;

/** Bản rút gọn của 1 mindmap, đủ để vẽ thẻ + lọc/tìm/sắp xếp phía client mà KHÔNG phải gửi toàn bộ từ
 * vựng xuống trình duyệt. Quan trọng với các file lớn: zh-false-friends có 1002 nhóm, zh-shape 596 —
 * gửi nguyên nội dung sẽ nặng hàng trăm KB, còn bản này chỉ ~80KB cho file lớn nhất.
 * `addedAt` cố tình cắt còn YYYY-MM-DD vì giao diện chỉ hiện tới ngày. */
export interface GroupSummary {
  id: string;
  reading: string;
  category?: string;
  addedAt?: string;
  rootCount: number;
  wordCount: number;
  /** Toàn bộ ký tự gốc — thẻ chỉ hiện vài cái đầu nhưng ô tìm kiếm cần tra được tất cả. */
  chars: string[];
  learned: boolean;
  /** Nhóm này do CHÍNH người học thêm, hoặc có chứa chữ/từ do họ thêm. Xem `ContentSource`. */
  userAdded: boolean;
  /** Các nhãn trình độ CÓ MẶT trong nhóm, xếp dễ → khó. Một nhóm thường trộn nhiều mức, nên lọc theo
   * "có chứa mức X" đúng hơn là gán cho cả nhóm một mức duy nhất. Rỗng = nhóm chưa được gắn nhãn. */
  levels: string[];
}

export function toGroupSummaries(
  groups: SoundGroup[],
  learnedIds: Set<string>,
  language: Language,
): GroupSummary[] {
  const scale = LEVEL_SCALE[language]?.values ?? [];
  return groups.map((g) => ({
    id: g.id,
    reading: g.reading,
    category: g.category,
    addedAt: g.addedAt?.slice(0, 10),
    rootCount: g.roots.length,
    wordCount: g.roots.reduce((sum, r) => sum + flattenWords(r.words).length, 0),
    chars: g.roots.map((r) => r.character),
    learned: learnedIds.has(g.id),
    userAdded:
      g.source === "user" ||
      g.roots.some((r) => r.source === "user" || flattenWords(r.words).some((w) => w.source === "user")),
    levels: (() => {
      const present = new Set(
        g.roots.flatMap((r) => flattenWords(r.words)).map((w) => w.level?.trim().toUpperCase()),
      );
      return scale.filter((v) => present.has(v));
    })(),
  }));
}

export function isRecent(addedAt?: string): boolean {
  if (!addedAt) return false;
  const t = Date.parse(addedAt);
  if (Number.isNaN(t)) return false;
  return Date.now() - t < NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

export function formatAdded(addedAt?: string): string {
  if (!addedAt) return "";
  const d = new Date(addedAt);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
