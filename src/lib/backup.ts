import "server-only";
import type { Language, ProgressStore, RootEntry, SoundGroup, VocabWord } from "@/types/vocab";
import { kvGet, kvKeys, kvSet } from "@/lib/kv";
import { ALL_LANGUAGES } from "@/lib/vocabStore";

interface DynamicAdditions {
  extraWords: Record<string, VocabWord[]>;
  extraRoots: Record<string, RootEntry[]>;
  wordChildren: Record<string, VocabWord[]>;
  extraGroups: SoundGroup[];
}

/** Bản backup hiện tại: chụp NGUYÊN toàn bộ key trong Redis (trừ những key ở `isExcludedKey`). Không
 * liệt kê tay từng key như v1/v2 — v2 từng bỏ sót danh sách cá nhân, tiến độ tình huống, ví dụ ngữ pháp
 * AI sinh và nhật ký từ mới vì các tính năng đó ra đời sau. Tính năng mới thêm key nào là tự có trong backup. */
export interface BackupDataV3 {
  version: 3;
  exportedAt: string;
  keys: Record<string, unknown>;
}

/** Định dạng cũ (v1 chưa có progressHistory/grammarProgress*) — chỉ còn dùng để khôi phục file cũ. */
export interface LegacyBackupData {
  version: 1 | 2;
  exportedAt: string;
  progress: ProgressStore;
  progressHistory?: Record<string, number>;
  grammarProgress?: ProgressStore;
  grammarProgressHistory?: Record<string, number>;
  vocabExtra: Partial<Record<Language, DynamicAdditions>>;
  mnemonics: Partial<Record<Language, Record<string, string>>>;
}

export type BackupData = BackupDataV3 | LegacyBackupData;

/** Không đưa vào backup:
 * - `ai:config`: chứa API key — bí mật, không nên nằm trong file JSON có thể bị chia sẻ nhầm. Khôi phục
 *   trên Redis mới thì nhập lại key thủ công.
 * - `backup:*`: chính các snapshot — đưa vào thì mỗi snapshot chứa các snapshot trước, phình theo cấp số. */
function isExcludedKey(key: string): boolean {
  return key === "ai:config" || key.startsWith("backup:");
}

export async function exportBackupData(): Promise<BackupDataV3> {
  const keys = (await kvKeys()).filter((k) => !isExcludedKey(k)).sort();
  const values = await Promise.all(keys.map((k) => kvGet<unknown>(k)));
  const out: Record<string, unknown> = {};
  keys.forEach((k, i) => {
    if (values[i] !== null) out[k] = values[i];
  });
  return { version: 3, exportedAt: new Date().toISOString(), keys: out };
}

/** Ghi lại mọi key trong backup (ghi đè key trùng tên; key không có trong backup giữ nguyên). */
export async function importBackupData(data: BackupData): Promise<void> {
  if (data.version === 3) {
    await Promise.all(
      Object.entries(data.keys)
        .filter(([k]) => !isExcludedKey(k))
        .map(([k, v]) => kvSet(k, v)),
    );
    return;
  }

  await Promise.all([
    kvSet("progress:main", data.progress ?? {}),
    kvSet("progress:history", data.progressHistory ?? {}),
    kvSet("progress:grammar", data.grammarProgress ?? {}),
    kvSet("progress:grammar:history", data.grammarProgressHistory ?? {}),
    ...ALL_LANGUAGES.map((lang) => {
      const extra = data.vocabExtra?.[lang];
      if (!extra) return Promise.resolve();
      return kvSet(`vocab:extra:${lang}`, extra);
    }),
    ...ALL_LANGUAGES.map((lang) => {
      const map = data.mnemonics?.[lang];
      if (!map) return Promise.resolve();
      return kvSet(`mnemonic:${lang}`, map);
    }),
  ]);
}

export interface BackupSummary {
  keyCount: number;
  totalTracked: number;
  grammarTracked: number;
}

/** Vài con số để admin nhận ra bản backup nào là bản nào (và bản nào rỗng bất thường). */
export function summarizeBackup(data: BackupData): BackupSummary {
  if (data.version === 3) {
    const count = (k: string) => Object.keys((data.keys[k] as object | undefined) ?? {}).length;
    return {
      keyCount: Object.keys(data.keys).length,
      totalTracked: count("progress:main"),
      grammarTracked: count("progress:grammar"),
    };
  }
  return {
    keyCount: 0,
    totalTracked: Object.keys(data.progress ?? {}).length,
    grammarTracked: Object.keys(data.grammarProgress ?? {}).length,
  };
}

export function isValidBackup(body: unknown): body is BackupData {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  const isObject = (v: unknown) => typeof v === "object" && v !== null;
  if (b.version === 3) return isObject(b.keys);
  return (
    (b.version === 1 || b.version === 2) && isObject(b.progress) && isObject(b.vocabExtra) && isObject(b.mnemonics)
  );
}
