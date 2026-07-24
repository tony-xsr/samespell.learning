import "server-only";
import { Redis } from "@upstash/redis";

let client: Redis | null = null;

function getClient(): Redis {
  if (client) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      "Thiếu UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN — tạo database miễn phí tại upstash.com rồi thêm vào .env.local.",
    );
  }
  client = new Redis({ url, token });
  return client;
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const value = await getClient().get<T>(key);
  return value ?? null;
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  await getClient().set(key, value);
}
