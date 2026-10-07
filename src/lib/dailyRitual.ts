import type { GroupKind, Language } from "@/types/vocab";

/** Một mindmap ứng viên cho nghi thức học hàng ngày (đã rút gọn, không mang theo từ vựng). */
export interface RitualCandidate {
  language: Language;
  groupKind: GroupKind;
  groupId: string;
  reading: string;
  chars: string[];
  rootCount: number;
  wordCount: number;
}

export type SlotId = "comfort" | "growth" | "stretch";

export interface RitualSlot {
  id: SlotId;
  label: string;
  icon: string;
  /** Vì sao bài này nằm ở ô này — hiện ngay trên thẻ, không bắt người dùng đoán. */
  rationale: string;
  pick: RitualCandidate;
  minutes: number;
}

/** Ngưỡng chia rổ theo SỐ TỪ TUYỆT ĐỐI, không theo phân vị.
 *
 * Lý do: 1729/3821 nhóm (45% kho) có đúng 2 từ — phần lớn là các cặp bẫy nghĩa, vốn chỉ gồm 1 chữ neo
 * và 2 từ ghép. Chia theo phân vị thì cả rổ "dễ" lẫn rổ "vừa sức" đều rơi trọn vào đám 2 từ này, và ô
 * "vừa sức" chẳng khó hơn ô "dễ thở" chút nào — đúng thứ mà ba ô sinh ra để tránh. Ngưỡng tuyệt đối
 * bảo đảm số từ tăng NGHIÊM NGẶT qua 3 ô. */
export const COMFORT_MAX_WORDS = 4;
export const GROWTH_MAX_WORDS = 8;

export const SLOT_META: Record<SlotId, { label: string; icon: string; rationale: string }> = {
  comfort: {
    label: "DỄ THỞ",
    icon: "☕",
    rationale: `${COMFORT_MAX_WORDS} từ trở xuống — mở đầu nhẹ để giữ thói quen, không phải để vã mồ hôi.`,
  },
  growth: {
    label: "VỪA SỨC",
    icon: "🌱",
    rationale: `${COMFORT_MAX_WORDS + 1}–${GROWTH_MAX_WORDS} từ — khó hơn một bậc, đây là chỗ thật sự tiến bộ.`,
  },
  stretch: {
    label: "THỬ THÁCH",
    icon: "🎯",
    rationale: `Trên ${GROWTH_MAX_WORDS} từ. Chưa học hết cũng không sao, cứ nhìn qua cho quen mặt.`,
  },
};

/** Ước lượng thời gian học 1 mindmap. Khoảng 15 giây cho mỗi từ (đọc + nghe + nhẩm nghĩa), tối thiểu
 * 1 phút để không bao giờ hiện "0 phút". */
export function estimateMinutes(wordCount: number): number {
  return Math.max(1, Math.round((wordCount * 15) / 60));
}

/** Hash chuỗi → số nguyên dương (FNV-1a 32-bit). Dùng để chọn ngẫu-nhiên-nhưng-cố-định theo ngày:
 * cùng một ngày thì luôn ra cùng bộ 3, sang ngày mới thì đổi. Không dùng Math.random vì server và
 * client phải cho ra cùng kết quả, và vì người dùng tải lại trang không được đổi bài. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** `YYYY-MM-DD` theo giờ ĐỊA PHƯƠNG của máy chạy. Không dùng toISOString() vì nó quy về UTC, làm
 * "hôm nay" ở Việt Nam (UTC+7) nhảy sang bài của hôm qua trong khoảng 0h–7h sáng. */
export function localDayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Chia kho mindmap thành 3 rổ theo độ dày rồi bốc mỗi rổ 1 cái theo ngày. */
export function pickDailySlots(pool: RitualCandidate[], dayKey: string): RitualSlot[] {
  if (pool.length === 0) return [];

  const sorted = [...pool].sort((a, b) => a.wordCount - b.wordCount || a.groupId.localeCompare(b.groupId));
  const buckets: Record<SlotId, RitualCandidate[]> = {
    comfort: sorted.filter((c) => c.wordCount <= COMFORT_MAX_WORDS),
    growth: sorted.filter((c) => c.wordCount > COMFORT_MAX_WORDS && c.wordCount <= GROWTH_MAX_WORDS),
    stretch: sorted.filter((c) => c.wordCount > GROWTH_MAX_WORDS),
  };

  const slots: RitualSlot[] = [];
  const used = new Set<string>();
  for (const id of ["comfort", "growth", "stretch"] as SlotId[]) {
    let bucket = buckets[id].filter((c) => !used.has(c.groupId));
    if (bucket.length === 0) {
      // Rổ rỗng (kho nhỏ, hoặc người học đã đánh dấu xong hết nhóm cỡ đó): lấy tạm từ phần còn lại,
      // nhưng vẫn lấy ĐÚNG ĐẦU tương ứng để thứ tự dễ → khó không bị đảo.
      const rest = sorted.filter((c) => !used.has(c.groupId));
      if (rest.length === 0) continue;
      const cut = Math.max(1, Math.ceil(rest.length / 3));
      bucket = id === "comfort" ? rest.slice(0, cut) : id === "growth" ? rest.slice(cut, cut * 2) : rest.slice(-cut);
      if (bucket.length === 0) bucket = rest;
    }
    if (bucket.length === 0) continue;
    const pick = bucket[hashString(`${dayKey}:${id}`) % bucket.length];
    used.add(pick.groupId);
    slots.push({ id, ...SLOT_META[id], pick, minutes: estimateMinutes(pick.wordCount) });
  }
  return slots;
}

export interface StreakInfo {
  current: number;
  longest: number;
  /** Hôm nay đã đánh dấu được mindmap nào chưa — quyết định câu động viên hiển thị. */
  doneToday: boolean;
}

/** Chuỗi ngày học, tính từ chính các mốc `learnedAt` đã lưu (không cần thêm kho dữ liệu riêng).
 *
 * `restDays` (0 = Chủ nhật … 6 = Thứ bảy) là ngày nghỉ: KHÔNG tính là học, nhưng cũng không làm đứt
 * chuỗi — nghỉ có kế hoạch thì khác với bỏ bê, và một chuỗi ngày trừng phạt người ta vì nghỉ cuối
 * tuần thì chỉ khiến người ta bỏ luôn.
 *
 * Chuỗi hiện tại được phép bắt đầu từ HÔM QUA: chưa học hôm nay thì chuỗi vẫn còn nguyên cho tới hết
 * ngày, chứ không về 0 ngay lúc 0h. */
export function computeStreak(
  learnedAtList: string[],
  restDays: number[] = [],
  today: Date = new Date(),
): StreakInfo {
  const days = new Set(learnedAtList.map((iso) => iso.slice(0, 10)).filter(Boolean));
  const rest = new Set(restDays);
  const todayKey = localDayKey(today);
  const doneToday = days.has(todayKey);

  const dayAt = (offset: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - offset);
    return d;
  };

  let current = 0;
  for (let i = doneToday ? 0 : 1; i < 3650; i += 1) {
    const d = dayAt(i);
    const key = localDayKey(d);
    if (days.has(key)) current += 1;
    else if (rest.has(d.getDay())) continue; // ngày nghỉ: bỏ qua, không cộng cũng không đứt
    else break;
  }

  // Chuỗi dài nhất: duyệt các ngày có học theo thứ tự, nối tiếp nếu khoảng trống chỉ gồm ngày nghỉ.
  const ordered = [...days].sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const key of ordered) {
    if (prev && isContiguous(prev, key, rest)) run += 1;
    else run = 1;
    longest = Math.max(longest, run);
    prev = key;
  }

  return { current, longest: Math.max(longest, current), doneToday };
}

/** `b` có nối liền sau `a` không, khi mọi ngày ở giữa đều là ngày nghỉ. */
function isContiguous(a: string, b: string, rest: Set<number>): boolean {
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  const gap = Math.round((db.getTime() - da.getTime()) / 86400000);
  if (gap <= 0) return false;
  if (gap === 1) return true;
  for (let i = 1; i < gap; i += 1) {
    const mid = new Date(da);
    mid.setDate(mid.getDate() + i);
    if (!rest.has(mid.getDay())) return false;
  }
  return true;
}

export const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
export const MAX_REST_DAYS = 3;
