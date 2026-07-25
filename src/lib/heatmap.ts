import { localDateKey } from "@/lib/dateKey";

export interface HeatmapDay {
  date: string;
  /** -1 nghĩa là ngày ở tương lai (chưa qua), không tính vào heatmap. */
  count: number;
}

function startOfWeekMonday(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay(); // 0=CN..6=T7
  const diff = (day + 6) % 7; // số ngày kể từ thứ 2
  copy.setDate(copy.getDate() - diff);
  return copy;
}

/** Chia lịch sử ôn tập thành lưới tuần (mỗi cột 1 tuần, mỗi cột 7 ô) để vẽ heatmap kiểu GitHub,
 * căn theo tuần thật (bắt đầu thứ 2), kết thúc ở tuần hiện tại. */
export function buildHeatmapWeeks(history: Record<string, number>, weeks = 18): HeatmapDay[][] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const gridStart = startOfWeekMonday(today);
  gridStart.setDate(gridStart.getDate() - (weeks - 1) * 7);

  const weeksArr: HeatmapDay[][] = [];
  for (let w = 0; w < weeks; w++) {
    const week: HeatmapDay[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(gridStart);
      day.setDate(day.getDate() + w * 7 + d);
      const key = localDateKey(day);
      const isFuture = day.getTime() > today.getTime();
      week.push({ date: key, count: isFuture ? -1 : (history[key] ?? 0) });
    }
    weeksArr.push(week);
  }
  return weeksArr;
}

export function heatmapLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count < 5) return 1;
  if (count < 15) return 2;
  if (count < 30) return 3;
  return 4;
}

export interface UpcomingDay {
  date: string;
  count: number;
}

export function buildUpcomingList(upcoming: Record<string, number>, days = 14): UpcomingDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const list: UpcomingDay[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const key = localDateKey(d);
    list.push({ date: key, count: upcoming[key] ?? 0 });
  }
  return list;
}

const WEEKDAY_VN = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export function formatShortDateVn(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`);
  return `${WEEKDAY_VN[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}
