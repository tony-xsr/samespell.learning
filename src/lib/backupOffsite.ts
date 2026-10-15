import "server-only";
import { Redis } from "@upstash/redis";
import { summarizeBackup, type BackupData, type BackupSummary } from "@/lib/backup";

/** Bản sao backup NGOÀI server: snapshot hằng ngày nằm chung Redis trên server, nên server mất dữ liệu
 * là mất luôn cả snapshot. Mỗi lần chụp snapshot thì đẩy thêm 1 bản sang Upstash (đã có sẵn từ hồi chạy
 * Vercel). Chỉ bật khi app đang chạy bằng Redis tự host (REDIS_URL) — nếu Upstash đang là kho chính thì
 * "bản sao" sẽ nằm cùng chỗ với bản gốc, vô nghĩa.
 * Key có tiền tố riêng `samespell:offsite:` nên không đụng dữ liệu cũ còn trong database Upstash đó. */
const PREFIX = "samespell:offsite:";
const INDEX_KEY = `${PREFIX}index`;
const MAX_COPIES = 30;

let client: Redis | null | undefined;

function getClient(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  client = process.env.REDIS_URL && url && token ? new Redis({ url, token }) : null;
  return client;
}

export function isOffsiteConfigured(): boolean {
  return getClient() !== null;
}

export async function pushOffsite(date: string, data: BackupData): Promise<void> {
  const redis = getClient();
  if (!redis) return;
  const index = ((await redis.get<string[]>(INDEX_KEY)) ?? []).filter((d) => d !== date);
  index.push(date);
  index.sort();
  const kept = index.slice(-MAX_COPIES);
  const dropped = index.slice(0, index.length - kept.length);
  await redis.set(`${PREFIX}${date}`, data);
  await redis.set(INDEX_KEY, kept);
  if (dropped.length > 0) await redis.del(...dropped.map((d) => `${PREFIX}${d}`));
}

export interface OffsiteSummary extends BackupSummary {
  date: string;
  exportedAt: string;
}

export async function listOffsite(): Promise<OffsiteSummary[]> {
  const redis = getClient();
  if (!redis) return [];
  const index = ((await redis.get<string[]>(INDEX_KEY)) ?? []).slice().sort().reverse();
  const copies = await Promise.all(index.map((d) => redis.get<BackupData>(`${PREFIX}${d}`)));
  return index.flatMap((date, i) => {
    const data = copies[i];
    return data ? [{ date, exportedAt: data.exportedAt, ...summarizeBackup(data) }] : [];
  });
}

export async function getOffsite(date: string): Promise<BackupData | null> {
  const redis = getClient();
  if (!redis) return null;
  return redis.get<BackupData>(`${PREFIX}${date}`);
}
