"use client";

import { useRef, useState } from "react";

export default function AdminBackup() {
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleDownload() {
    setError(null);
    setMessage(null);
    setDownloading(true);
    try {
      const res = await fetch("/api/admin/backup");
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Không xuất được backup.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `samespell-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage("Đã tải file backup xuống máy.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setDownloading(false);
    }
  }

  function handlePickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setPendingFile(file ?? null);
    setMessage(null);
    setError(null);
  }

  async function handleConfirmRestore() {
    if (!pendingFile) return;
    setError(null);
    setMessage(null);
    setRestoring(true);
    try {
      const text = await pendingFile.text();
      const json = JSON.parse(text);
      const res = await fetch("/api/admin/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Không khôi phục được backup.");
      setMessage("Đã khôi phục dữ liệu từ backup. Tải lại trang để xem thay đổi.");
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e) {
      setError(e instanceof Error ? e.message : "File backup không hợp lệ hoặc lỗi khi khôi phục.");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface-2 p-5 shadow-sm">
      <h2 className="font-semibold text-ink">Sao lưu &amp; khôi phục dữ liệu</h2>
      <p className="mt-1 text-xs text-ink-muted">
        Xuất toàn bộ tiến trình học, từ vựng AI sinh thêm, và mẹo nhớ ra 1 file JSON để phòng khi
        tài khoản Upstash Redis bị mất quyền truy cập — chỉ cần tạo database mới rồi khôi phục lại
        từ file này. (Không bao gồm API key AI — nhập lại thủ công sau khi khôi phục.)
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-md hover:brightness-105 disabled:opacity-50"
        >
          {downloading ? "Đang xuất…" : "⬇️ Tải backup xuống"}
        </button>

        <label className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-3 cursor-pointer">
          📂 Chọn file backup…
          <input ref={fileInputRef} type="file" accept="application/json" onChange={handlePickFile} className="hidden" />
        </label>
      </div>

      {pendingFile && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <span>
            Khôi phục từ <span className="font-semibold">{pendingFile.name}</span>? Dữ liệu hiện tại sẽ bị ghi đè.
          </span>
          <button
            onClick={handleConfirmRestore}
            disabled={restoring}
            className="font-semibold text-green-700 underline hover:no-underline disabled:opacity-50 dark:text-green-400"
          >
            {restoring ? "Đang khôi phục…" : "Có, khôi phục"}
          </button>
          <button
            onClick={() => {
              setPendingFile(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            className="font-semibold text-ink-muted underline hover:no-underline"
          >
            Hủy
          </button>
        </div>
      )}

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
