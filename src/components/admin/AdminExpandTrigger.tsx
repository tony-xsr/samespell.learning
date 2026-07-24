"use client";

import { useState } from "react";

interface ExpandBatchResult {
  actions: { language: string; groupId: string; rootId: string; character: string; addedWords: number }[];
  totalWordsAdded: number;
  errors: string[];
}

export default function AdminExpandTrigger() {
  const [language, setLanguage] = useState<"" | "zh" | "ko" | "ja">("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ExpandBatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/expand-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(language ? { language } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Chạy thất bại");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface-2 p-5 shadow-sm">
      <h2 className="font-semibold text-ink">Mở rộng từ vựng thủ công</h2>
      <p className="mt-1 text-xs text-ink-muted">
        Quét các chữ gốc đang có ít từ (&lt; 5 từ), nhờ AI sinh thêm — tự tránh trùng lặp với từ đã có.
        Đây là bước chuẩn bị cho cronjob tự động sau này (hiện tại chỉ chạy khi bấm nút).
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as typeof language)}
          className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
        >
          <option value="">Tất cả ngôn ngữ</option>
          <option value="zh">Tiếng Trung</option>
          <option value="ko">Tiếng Hàn</option>
          <option value="ja">Tiếng Nhật</option>
        </select>
        <button
          onClick={handleRun}
          disabled={running}
          className="rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:brightness-105 disabled:opacity-50"
        >
          {running ? "Đang chạy…" : "🚀 Mở rộng ngay"}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-4 text-sm">
          <p className="font-medium text-ink">
            Đã thêm {result.totalWordsAdded} từ mới qua {result.actions.length} chữ gốc.
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-xs text-ink-muted">
            {result.actions.map((a, i) => (
              <li key={i}>
                {a.language}/{a.character}: +{a.addedWords} từ
              </li>
            ))}
          </ul>
          {result.errors.length > 0 && (
            <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {result.errors.map((e, i) => (
                <div key={i}>{e}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
