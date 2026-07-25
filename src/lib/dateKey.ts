/** "yyyy-mm-dd" theo giờ ĐỊA PHƯƠNG của máy chạy code (server chạy `next dev`/self-host), KHÔNG
 * dùng Date.toISOString() vì nó quy đổi sang UTC trước — với múi giờ Việt Nam (UTC+7), làm vậy sẽ
 * lùi ngày lại 1 hôm mỗi khi giờ địa phương còn trước 7h sáng (VD 2026-07-24 00:00 GMT+7 in ra
 * "2026-07-23" nếu dùng toISOString), khiến heatmap/lịch sử ôn tập ghi sai ngày. */
export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
