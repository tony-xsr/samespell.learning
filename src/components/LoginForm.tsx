"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ThemeSwitcher from "@/components/ThemeSwitcher";

export default function LoginForm({
  title,
  endpoint,
  defaultRedirect,
}: {
  title: string;
  endpoint: string;
  defaultRedirect: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Đăng nhập thất bại");
      const next = searchParams.get("next") ?? defaultRedirect;
      router.push(next);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center bg-gradient-to-br from-brand-600 via-brand-500 to-accent-500 px-4 py-16">
      <div className="absolute top-4 right-4">
        <ThemeSwitcher />
      </div>

      <div className="mb-6 text-center text-white">
        <div className="text-4xl">📖</div>
        <div className="mt-1 text-lg font-bold tracking-tight">SameSpell Learning</div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-3xl border border-white/40 bg-surface-2 p-6 shadow-xl"
      >
        <h1 className="text-xl font-bold text-ink">{title}</h1>

        <label className="mt-4 block text-sm font-medium text-ink-muted">Tên đăng nhập</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
          className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200"
        />

        <label className="mt-3 block text-sm font-medium text-ink-muted">Mật khẩu</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200"
        />

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-5 w-full rounded-full bg-gradient-to-r from-brand-600 to-accent-500 py-2.5 text-sm font-semibold text-white shadow-md transition hover:brightness-105 active:brightness-95 disabled:opacity-50"
        >
          {loading ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>
      </form>
    </main>
  );
}
