"use client";

import { useState } from "react";
import { MAX_REST_DAYS, WEEKDAY_LABELS } from "@/lib/dailyRitual";

export default function RitualRestDays({ initial }: { initial: number[] }) {
  const [days, setDays] = useState<number[]>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(d: number) {
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort();
    if (next.length > MAX_REST_DAYS) {
      setError(`Tối đa ${MAX_REST_DAYS} ngày nghỉ mỗi tuần.`);
      return;
    }
    setError(null);
    setDays(next);
    setSaving(true);
    try {
      const res = await fetch("/api/personal-lists/ritual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restDays: next }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Lưu thất bại.");
    } catch (e) {
      setDays(days); // trả về trạng thái cũ thay vì để giao diện nói dối là đã lưu
      setError(e instanceof Error ? e.message : "Lưu thất bại.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Ngày nghỉ (tối đa {MAX_REST_DAYS})
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {WEEKDAY_LABELS.map((label, d) => {
          const on = days.includes(d);
          return (
            <button
              key={d}
              type="button"
              disabled={saving}
              onClick={() => toggle(d)}
              aria-pressed={on}
              aria-label={`Ngày nghỉ ${label}`}
              className={`h-9 w-9 rounded-full border text-xs font-semibold transition disabled:opacity-50 ${
                on
                  ? "border-brand-500 bg-brand-600 text-white"
                  : "border-border bg-surface-2 text-ink-muted hover:bg-surface-3"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        Ngày nghỉ tạm dừng nghi thức mà <span className="font-semibold text-ink">không làm đứt chuỗi</span>.
      </p>
      {error && <p className="mt-1 text-xs font-medium text-rose-500">{error}</p>}
    </div>
  );
}
