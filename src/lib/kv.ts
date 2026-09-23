import "server-only";
import { Redis as UpstashRedis } from "@upstash/redis";
import IORedis from "ioredis";

/** Hai backend cùng một API get/set/del:
 * - REDIS_URL (vd. redis://samespell-redis:6379) → Redis tự host qua TCP (server riêng, xem deploy.sh).
 * - Ngược lại → Upstash REST (Vercel / chạy local không có Redis).
 * Giá trị được serialize giống hệt @upstash/redis (chuỗi giữ nguyên, còn lại JSON.stringify) nên dữ
 * liệu copy thô từ Upstash sang Redis local đọc lại được y như cũ. */
interface KvBackend {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  del(key: string): Promise<void>;
}

let backend: KvBackend | null = null;

function serialize(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function deserialize<T>(raw: string | null): T | null {
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as T;
  }
}

function createBackend(): KvBackend {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const client = new IORedis(redisUrl, { maxRetriesPerRequest: 3 });
    return {
      get: async <T>(key: string) => deserialize<T>(await client.get(key)),
      set: async (key, value) => {
        await client.set(key, serialize(value));
      },
      del: async (key) => {
        await client.del(key);
      },
    };
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      "Thiếu REDIS_URL hoặc UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN — cấu hình một trong hai trong .env.local.",
    );
  }
  const client = new UpstashRedis({ url, token });
  return {
    get: async <T>(key: string) => (await client.get<T>(key)) ?? null,
    set: async (key, value) => {
      await client.set(key, value);
    },
    del: async (key) => {
      await client.del(key);
    },
  };
}

function getBackend(): KvBackend {
  if (!backend) backend = createBackend();
  return backend;
}

export async function kvGet<T>(key: string): Promise<T | null> {
  return getBackend().get<T>(key);
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  await getBackend().set(key, value);
}

export async function kvDel(key: string): Promise<void> {
  await getBackend().del(key);
}
