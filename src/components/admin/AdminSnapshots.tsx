"use client";

import { useEffect, useState } from "react";

interface SnapshotSummary {
  date: string;
  exportedAt: string;
  totalTracked: number;
  grammarTracked: number;
}

export default function AdminSnapshots() {
  const [snapshots, setSnapshots] = useState<SnapshotSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingNow, setSavingNow] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [pendingRestore, setPendingRestore] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadSnapshots() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/backup-snapshots");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Không tải được danh sách snapshot.");
      setSnapshots(data.snapshots);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSnapshots();
  }, []);

  async function handleSaveNow() {
    setSavingNow(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/backup-snapshots", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Không lưu được snapshot.");
      setMessage(`Đã lưu snapshot ngày ${data.date}.`);
      await loadSnapshots();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setSavingNow(false);
    }
  }

  async function handleConfirmRestore(date: string) {
    setRestoring(date);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/backup-snapshots/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Không khôi phục được snapshot.");
      setMessage(`Đã khôi phục dữ liệu từ snapshot ngày ${date}. Tải lại trang để xem thay đổi.`);
      setPendingRestore(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setRestoring(null);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface-2 p-5 shadow-sm">
      <h2 className="font-semibold text-ink">Snapshot tự động (Redis)</h2>
      <p className="mt-1 text-xs text-ink-muted">
        Vercel Cron tự chạy mỗi ngày, lưu 1 bản chụp tiến trình + từ vựng AI sinh thêm + mẹo nhớ ngay
        trong Redis (giữ tối đa 14 ngày gần nhất). Khác với &ldquo;Sao lưu &amp; khôi phục&rdquo; ở
        trên (tải file JSON về máy), đây chỉ chống các sự cố ghi đè/hỏng dữ liệu do thao tác nhầm —
        không thay thế việc tải file backup về khi đổi tài khoản Redis.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={handleSaveNow}
          disabled={savingNow}
          className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-3 disabled:opacity-50"
        >
          {savingNow ? "Đang lưu…" : "📸 Sao lưu ngay"}
        </button>
      </div>

      <div className="mt-3">
        {loading && <p className="text-xs text-ink-muted">Đang tải…</p>}
        {!loading && snapshots && snapshots.length === 0 && (
          <p className="text-xs text-ink-muted">Chưa có snapshot nào.</p>
        )}
        {!loading && snapshots && snapshots.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {snapshots.map((s) => (
              <li
                key={s.date}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs"
              >
                <span className="font-medium text-ink">
                  {s.date}{" "}
                  <span className="font-normal text-ink-muted">
                    · {s.totalTracked} thẻ từ vựng · {s.grammarTracked} thẻ ngữ pháp
                  </span>
                </span>
                {pendingRestore === s.date ? (
                  <span className="flex items-center gap-2">
                    <span className="text-amber-700 dark:text-amber-400">Ghi đè dữ liệu hiện tại?</span>
                    <button
                      onClick={() => handleConfirmRestore(s.date)}
                      disabled={restoring === s.date}
                      className="font-semibold text-green-700 underline hover:no-underline disabled:opacity-50 dark:text-green-400"
                    >
                      {restoring === s.date ? "Đang khôi phục…" : "Có, khôi phục"}
                    </button>
                    <button
                      onClick={() => setPendingRestore(null)}
                      className="font-semibold text-ink-muted underline hover:no-underline"
                    >
                      Hủy
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setPendingRestore(s.date)}
                    className="font-semibold text-brand-600 underline hover:no-underline"
                  >
                    Khôi phục
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {message && (
        <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-400">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
