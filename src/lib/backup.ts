import "server-only";
import type { Language, ProgressStore, RootEntry, VocabWord } from "@/types/vocab";
import { kvGet, kvSet } from "@/lib/kv";
import { ALL_LANGUAGES } from "@/lib/vocabStore";

interface DynamicAdditions {
  extraWords: Record<string, VocabWord[]>;
  extraRoots: Record<string, RootEntry[]>;
  wordChildren: Record<string, VocabWord[]>;
}

export interface BackupData {
  version: 1;
  exportedAt: string;
  progress: ProgressStore;
  vocabExtra: Partial<Record<Language, DynamicAdditions>>;
  mnemonics: Partial<Record<Language, Record<string, string>>>;
}

// Cấu hình AI (API key) KHÔNG được đưa vào backup — đó là bí mật, không nên nằm trong
// file JSON có thể bị chia sẻ nhầm. Khi khôi phục trên Redis mới, nhập lại key thủ công.

export async function exportBackupData(): Promise<BackupData> {
  const [progress, vocabEntries, mnemonicEntries] = await Promise.all([
    kvGet<ProgressStore>("progress:main"),
    Promise.all(
      ALL_LANGUAGES.map(async (lang) => [lang, await kvGet<DynamicAdditions>(`vocab:extra:${lang}`)] as const),
    ),
    Promise.all(
      ALL_LANGUAGES.map(
        async (lang) => [lang, await kvGet<Record<string, string>>(`mnemonic:${lang}`)] as const,
      ),
    ),
  ]);

  const vocabExtra: Partial<Record<Language, DynamicAdditions>> = {};
  for (const [lang, data] of vocabEntries) {
    if (data) vocabExtra[lang] = data;
  }
  const mnemonics: Partial<Record<Language, Record<string, string>>> = {};
  for (const [lang, data] of mnemonicEntries) {
    if (data) mnemonics[lang] = data;
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    progress: progress ?? {},
    vocabExtra,
    mnemonics,
  };
}

export async function importBackupData(data: BackupData): Promise<void> {
  await Promise.all([
    kvSet("progress:main", data.progress ?? {}),
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
