import type { ProgressStore, WordProgress } from "@/types/vocab";
import type { CardInfo } from "@/lib/reviewCards";
import { isDue } from "@/lib/srs";

/** Xếp hàng thẻ cho một phiên ôn, và tính "mốc đã ôn tới" của cả nhóm. Xem Features.md mục 33.
 *
 * Trước đây `ReviewSession` chỉ làm: lọc thẻ đến hạn → `shuffle` phẳng → lấy hết. Nhóm 200 từ thành
 * một phiên 200 thẻ, bỏ dở thì lần sau xáo lại từ đầu, và từ CHƯA ÔN LẦN NÀO nằm lẫn lộn với từ đã ôn
 * mấy lượt rồi. Người học không có cách nào biết mình đã đi tới đâu.
 *
 * Không lưu "con trỏ phiên" ở đâu cả — mốc được TÍNH RA từ `progress:main` (`reviewCount`/`dueAt`/
 * `mastered`), thứ vốn đã lưu sẵn trên server. Một chỉ số lưu riêng sẽ lệch ngay khi nhóm được thêm
 * từ mới, khi người học ôn cùng từ đó từ màn hình khác, hay khi mở trên máy khác; còn mốc tính ra thì
 * luôn đúng và tự đồng bộ giữa các thiết bị. */

/** Mức ưu tiên của một thẻ. Thứ tự khai báo CHÍNH LÀ thứ tự ôn. */
export type CardTier = "new" | "overdue" | "later";

export interface QueuedCard extends CardInfo {
  tier: CardTier;
  /** Đã chấm điểm bao nhiêu lần (0 = chưa ôn lần nào). Hiển thị ngay trên thẻ. */
  reviewCount: number;
}

export interface ReviewStats {
  /** Tổng số từ trong phạm vi ôn (tính cả từ đã thuộc). */
  total: number;
  /** Đã đánh dấu "đã thuộc kỹ" — coi như xong, không bao giờ vào hàng nữa. */
  mastered: number;
  /** Đã chấm điểm ít nhất 1 lần và chưa đánh dấu đã thuộc. */
  reviewed: number;
  /** Chưa chấm điểm lần nào — đây là phần người học muốn được ưu tiên. */
  neverReviewed: number;
  /** Số thẻ CÒN LẠI đáng ôn ngay bây giờ (trước khi cắt theo cỡ phiên). */
  pending: number;
}

function tierOf(p: WordProgress | undefined): CardTier {
  if (!p || p.reviewCount === 0) return "new";
  return isDue(p) ? "overdue" : "later";
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildReviewQueue(
  cards: CardInfo[],
  progress: ProgressStore,
  limit?: number,
): { queue: QueuedCard[]; stats: ReviewStats } {
  const total = cards.length;
  let mastered = 0;
  let reviewed = 0;
  let neverReviewed = 0;

  const buckets: Record<CardTier, QueuedCard[]> = { new: [], overdue: [], later: [] };

  for (const c of cards) {
    const p = progress[c.word.id];
    if (c.mastered) {
      mastered++;
      continue;
    }
    const count = p?.reviewCount ?? 0;
    if (count === 0) neverReviewed++;
    else reviewed++;
    const tier = tierOf(p);
    buckets[tier].push({ ...c, tier, reviewCount: count });
  }

  // Từ chưa ôn lần nào lên trước — xáo trong nội bộ để không phải lúc nào cũng đúng một thứ tự.
  const fresh = shuffle(buckets.new);
  // Từ đã ôn rồi nhưng tới hạn: QUÁ HẠN LÂU NHẤT trước, vì đó là từ sắp quên nhất. Thứ tự này cố ý
  // không xáo — nó có nghĩa thật, xáo đi là vứt mất thông tin.
  const overdue = [...buckets.overdue].sort(
    (a, b) => new Date(progress[a.word.id]!.dueAt).getTime() - new Date(progress[b.word.id]!.dueAt).getTime(),
  );

  // Hết từ đến hạn thì mới lôi từ chưa tới hạn ra ôn thêm (giữ nguyên hành vi cũ: không bao giờ để
  // người học rơi vào màn hình trống chỉ vì hôm nay chưa tới lịch) — sớm tới hạn nhất trước.
  const fallback =
    fresh.length + overdue.length > 0
      ? []
      : [...buckets.later].sort(
          (a, b) =>
            new Date(progress[a.word.id]!.dueAt).getTime() - new Date(progress[b.word.id]!.dueAt).getTime(),
        );

  const ordered = [...fresh, ...overdue, ...fallback];
  const queue = limit && limit > 0 ? ordered.slice(0, limit) : ordered;

  return {
    queue,
    stats: { total, mastered, reviewed, neverReviewed, pending: ordered.length },
  };
}

/** Cỡ một phiên ôn khi nơi gọi không tự đặt giới hạn (vd "🗂️ Ôn tập nhóm này" trên một nhóm 200 từ).
 * Chia nhỏ để người học luôn kết thúc được một phiên thay vì bỏ dở giữa chừng — phần còn lại nằm sẵn
 * ở nút "Ôn tiếp" trên màn hình kết thúc. */
export const DEFAULT_SESSION_SIZE = 20;
