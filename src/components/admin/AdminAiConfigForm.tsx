"use client";

import { useEffect, useState } from "react";

interface AiConfigResponse {
  providers: { id: string; label: string; defaultModel: string }[];
  activeProvider: string;
  models: Record<string, string>;
  maskedKeys: Record<string, string>;
  hasKey: Record<string, boolean>;
}

export default function AdminAiConfigForm() {
  const [config, setConfig] = useState<AiConfigResponse | null>(null);
  const [activeProvider, setActiveProvider] = useState("");
  const [models, setModels] = useState<Record<string, string>>({});
  const [newKeys, setNewKeys] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/ai-config")
      .then((res) => res.json())
      .then((data: AiConfigResponse) => {
        setConfig(data);
        setActiveProvider(data.activeProvider);
        setModels(data.models);
      });
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/ai-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeProvider, models, keys: newKeys }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lưu thất bại");
      setMessage("Đã lưu cấu hình AI.");
      setNewKeys({});
      const refreshed = await fetch("/api/admin/ai-config").then((r) => r.json());
      setConfig(refreshed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  }

  if (!config) {
    return <p className="text-sm text-ink-muted">Đang tải cấu hình AI…</p>;
  }

  return (
    <div className="rounded-2xl border border-border bg-surface-2 p-5 shadow-sm">
      <h2 className="font-semibold text-ink">Cấu hình nhà cung cấp AI</h2>
      <p className="mt-1 text-xs text-ink-muted">
        Chọn provider đang dùng để sinh từ vựng / mindmap. Để trống ô key nếu không muốn đổi key đã lưu.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        {config.providers.map((p) => (
          <div
            key={p.id}
            className={`rounded-xl border-2 px-3 py-3 transition ${
              activeProvider === p.id
                ? "border-brand-500 bg-brand-50"
                : "border-border bg-surface-3/40"
            }`}
          >
            <label className="flex items-center gap-2 text-sm font-medium text-ink">
              <input
                type="radio"
                name="activeProvider"
                checked={activeProvider === p.id}
                onChange={() => setActiveProvider(p.id)}
                className="accent-brand-600"
              />
              {p.label}
              {config.hasKey[p.id] && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-950/50 dark:text-green-400">
                  đã có key
                </span>
              )}
            </label>

            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className="text-xs text-ink-muted">API key</label>
                <input
                  type="password"
                  placeholder={config.maskedKeys[p.id] || "chưa có key"}
                  value={newKeys[p.id] ?? ""}
                  onChange={(e) => setNewKeys((k) => ({ ...k, [p.id]: e.target.value }))}
                  className="mt-0.5 w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200"
                />
              </div>
              <div>
                <label className="text-xs text-ink-muted">Model</label>
                <input
                  type="text"
                  value={models[p.id] ?? p.defaultModel}
                  onChange={(e) => setModels((m) => ({ ...m, [p.id]: e.target.value }))}
                  className="mt-0.5 w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </p>
      )}
      {message && (
        <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-400">
          {message}
        </p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-4 rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-5 py-2 text-sm font-semibold text-white shadow-md hover:brightness-105 disabled:opacity-50"
      >
        {saving ? "Đang lưu…" : "Lưu cấu hình"}
      </button>
    </div>
  );
}
