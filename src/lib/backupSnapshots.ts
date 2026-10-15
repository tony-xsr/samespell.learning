import "server-only";
import { kvGet, kvSet, kvDel } from "@/lib/kv";
import {
  exportBackupData,
  importBackupData,
  summarizeBackup,
  type BackupData,
  type BackupSummary,
} from "@/lib/backup";
import { pushOffsite } from "@/lib/backupOffsite";

/** Backup Redis tự động (cron gọi mỗi ngày, xem `/api/cron/backup-snapshot`): lưu snapshot ngay
 * trong chính Redis đó, dưới key riêng theo ngày — chống các sự cố "ghi đè/hỏng dữ liệu do thao tác
 * nhầm" (ví dụ AI sinh lỗi, xoá nhầm) vì luôn có snapshot vài ngày gần nhất để khôi phục lại. Mỗi
 * snapshot cũng được đẩy 1 bản ra ngoài server (xem backupOffsite.ts) — phòng khi mất cả server. */
const INDEX_KEY = "backup:snapshot:index";
const MAX_SNAPSHOTS = 14;

function snapshotKey(date: string): string {
  return `backup:snapshot:${date}`;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function saveSnapshot(): Promise<{ date: string; offsiteError?: string }> {
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

  // Bản ngoài server lỗi (mất mạng, Upstash hết quota…) thì vẫn giữ snapshot trên server, chỉ báo lại.
  try {
    await pushOffsite(date, data);
    return { date };
  } catch (e) {
    return { date, offsiteError: e instanceof Error ? e.message : "Không đẩy được bản sao ngoài server." };
  }
}

export interface SnapshotSummary extends BackupSummary {
  date: string;
  exportedAt: string;
}

export async function listSnapshots(): Promise<SnapshotSummary[]> {
  const index = ((await kvGet<string[]>(INDEX_KEY)) ?? []).slice().sort().reverse();
  const snapshots = await Promise.all(index.map((date) => kvGet<BackupData>(snapshotKey(date))));
  const summaries: SnapshotSummary[] = [];
  index.forEach((date, i) => {
    const data = snapshots[i];
    if (!data) return;
    summaries.push({ date, exportedAt: data.exportedAt, ...summarizeBackup(data) });
  });
  return summaries;
}

export async function restoreSnapshot(date: string): Promise<void> {
  const data = await kvGet<BackupData>(snapshotKey(date));
  if (!data) throw new Error(`Không tìm thấy snapshot ngày ${date}.`);
  await importBackupData(data);
}
