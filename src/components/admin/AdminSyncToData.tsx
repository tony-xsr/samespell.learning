"use client";

import { useState } from "react";

interface SyncResult {
  lang: string;
  file: string;
  addedWords: number;
  addedRoots: number;
  addedGroups: number;
  skipped: boolean;
}

export default function AdminSyncToData() {
  const [syncing, setSyncing] = useState(false);
  const [results, setResults] = useState<SyncResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setError(null);
    setResults(null);
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/sync-to-data", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Không gộp được dữ liệu.");
      setResults(data.results);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface-2 p-5 shadow-sm">
      <h2 className="font-semibold text-ink">Gộp từ AI vào data/*.json</h2>
      <p className="mt-1 text-xs text-ink-muted">
        Từ vựng do AI sinh thêm (nút &ldquo;Thêm từ&rdquo;, &ldquo;mở rộng nhánh&rdquo;, &ldquo;tìm chữ mới&rdquo;)
        chỉ lưu tạm trong Upstash Redis, không nằm trong file data/ nên sẽ mất nếu đổi database Redis.
        Bấm nút dưới để ghi vĩnh viễn các từ đó vào data/&#123;lang&#125;.json trên đĩa — sau đó nhớ commit
        git để không mất. <span className="font-semibold">Chỉ hoạt động khi chạy `next dev` trên máy có quyền ghi
        file (localhost)</span>, không có tác dụng khi deploy trên Vercel (filesystem chỉ đọc).
      </p>

      <button
        onClick={handleSync}
        disabled={syncing}
        className="mt-3 rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:brightness-105 disabled:opacity-50"
      >
        {syncing ? "Đang gộp…" : "🗄️ Gộp vào data/*.json"}
      </button>

      {results && (
        <ul className="mt-3 space-y-1 text-xs text-ink-muted">
          {results.map((r) => (
            <li key={r.lang}>
              <span className="font-semibold text-ink">{r.lang}</span>:{" "}
              {r.skipped
                ? "không có gì mới để gộp."
                : `đã thêm ${r.addedWords} từ, ${r.addedRoots} chữ gốc, ${r.addedGroups} nhóm mới vào ${r.file}.`}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
