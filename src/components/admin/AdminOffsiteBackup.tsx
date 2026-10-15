"use client";

import { useEffect, useState } from "react";

interface OffsiteSummary {
  date: string;
  exportedAt: string;
  keyCount: number;
  totalTracked: number;
  grammarTracked: number;
}

export default function AdminOffsiteBackup() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [copies, setCopies] = useState<OffsiteSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [pendingRestore, setPendingRestore] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadCopies() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/backup-offsite");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Không tải được danh sách bản sao.");
      setConfigured(data.configured);
      setCopies(data.copies);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCopies();
  }, []);

  async function handleConfirmRestore(date: string) {
    setRestoring(date);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/backup-offsite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Không khôi phục được bản sao.");
      setMessage(`Đã khôi phục dữ liệu từ bản sao ngày ${date}. Tải lại trang để xem thay đổi.`);
      setPendingRestore(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setRestoring(null);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface-2 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-ink">Bản sao ngoài server (Upstash)</h2>
        <button
          onClick={loadCopies}
          disabled={loading}
          className="text-xs font-semibold text-brand-600 underline hover:no-underline disabled:opacity-50"
        >
          Tải lại
        </button>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        Mỗi lần chụp snapshot (cron hằng ngày hoặc bấm &ldquo;Sao lưu ngay&rdquo;) đều gửi thêm 1 bản đầy đủ
        sang Upstash, giữ 30 ngày gần nhất. Server hỏng hay mất sạch Redis (mất luôn cả snapshot) thì
        deploy lại rồi khôi phục từ đây.
      </p>

      <div className="mt-3">
        {configured === false && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            Chưa bật: cần UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN trong .env, và app phải đang chạy
            bằng Redis trên server (REDIS_URL).
          </p>
        )}
        {loading && configured === null && <p className="text-xs text-ink-muted">Đang tải…</p>}
        {configured && copies.length === 0 && !loading && (
          <p className="text-xs text-ink-muted">Chưa có bản sao nào — bấm &ldquo;📸 Sao lưu ngay&rdquo; ở dưới.</p>
        )}
        {configured && copies.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {copies.map((c) => (
              <li
                key={c.date}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs"
              >
                <span className="font-medium text-ink">
                  {c.date}{" "}
                  <span className="font-normal text-ink-muted">
                    · {c.keyCount > 0 ? `${c.keyCount} mục dữ liệu · ` : ""}
                    {c.totalTracked} thẻ từ vựng · {c.grammarTracked} thẻ ngữ pháp
                  </span>
                </span>
                {pendingRestore === c.date ? (
                  <span className="flex items-center gap-2">
                    <span className="text-amber-700 dark:text-amber-400">Ghi đè dữ liệu hiện tại?</span>
                    <button
                      onClick={() => handleConfirmRestore(c.date)}
                      disabled={restoring === c.date}
                      className="font-semibold text-green-700 underline hover:no-underline disabled:opacity-50 dark:text-green-400"
                    >
                      {restoring === c.date ? "Đang khôi phục…" : "Có, khôi phục"}
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
                    onClick={() => setPendingRestore(c.date)}
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
