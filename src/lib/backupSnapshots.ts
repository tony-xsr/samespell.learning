import "server-only";
import { kvGet, kvSet, kvDel } from "@/lib/kv";
import { exportBackupData, importBackupData, type BackupData } from "@/lib/backup";

/** Backup Redis tự động (cron gọi mỗi ngày, xem `/api/cron/backup-snapshot`): lưu snapshot ngay
 * trong chính Redis đó, dưới key riêng theo ngày — không thay thế việc tải file JSON về máy (đề
 * phòng mất quyền truy cập Redis), nhưng chống được các sự cố "ghi đè/hỏng dữ liệu do thao tác
 * nhầm" (ví dụ AI sinh lỗi, xoá nhầm) vì luôn có snapshot vài ngày gần nhất để khôi phục lại. */
const INDEX_KEY = "backup:snapshot:index";
const MAX_SNAPSHOTS = 14;

function snapshotKey(date: string): string {
  return `backup:snapshot:${date}`;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function saveSnapshot(): Promise<{ date: string }> {
  const date = todayKey();
  const data = await exportBackupData();
  const index = ((await kvGet<string[]>(INDEX_KEY)) ?? []).filter((d) => d !== date);
  index.push(date);
  index.sort();
  const trimmed = index.slice(-MAX_SNAPSHOTS);
  const dropped = index.slice(0, index.length - trimmed.length);

  await Promise.all([
    kvSet(snapshotKey(date), data),
    kvSet(INDEX_KEY, trimmed),
    ...dropped.map((d) => kvDel(snapshotKey(d))),
  ]);
  return { date };
}

export interface SnapshotSummary {
  date: string;
  exportedAt: string;
  totalTracked: number;
  grammarTracked: number;
}

export async function listSnapshots(): Promise<SnapshotSummary[]> {
  const index = ((await kvGet<string[]>(INDEX_KEY)) ?? []).slice().sort().reverse();
  const snapshots = await Promise.all(index.map((date) => kvGet<BackupData>(snapshotKey(date))));
  const summaries: SnapshotSummary[] = [];
  index.forEach((date, i) => {
    const data = snapshots[i];
    if (!data) return;
    summaries.push({
      date,
      exportedAt: data.exportedAt,
      totalTracked: Object.keys(data.progress ?? {}).length,
      grammarTracked: Object.keys(data.grammarProgress ?? {}).length,
    });
  });
  return summaries;
}

export async function restoreSnapshot(date: string): Promise<void> {
  const data = await kvGet<BackupData>(snapshotKey(date));
  if (!data) throw new Error(`Không tìm thấy snapshot ngày ${date}.`);
  await importBackupData(data);
}
