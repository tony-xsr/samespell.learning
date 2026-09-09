"use client";

export type ViewMode = "grid" | "list";

/** Nút chuyển đổi Lưới/Danh sách dùng chung cho các trang browser (nối đuôi, đồng nghĩa-trái nghĩa,
 * cặp chữ trái nghĩa...). Mặc định của các trang gọi component này là "grid" — xem hàm gọi. */
export default function ViewModeToggle({ mode, onChange }: { mode: ViewMode; onChange: (mode: ViewMode) => void }) {
  return (
    <div className="flex flex-none items-center gap-1 rounded-full border border-border bg-surface-2 p-1">
      <button
        type="button"
        onClick={() => onChange("grid")}
        className={`flex h-7 w-7 items-center justify-center rounded-full text-sm transition ${
          mode === "grid" ? "bg-brand-600 text-white shadow-sm" : "text-ink-muted hover:bg-surface-3"
        }`}
        aria-label="Xem dạng lưới"
        aria-pressed={mode === "grid"}
        title="Xem dạng lưới"
      >
        ▦
      </button>
      <button
        type="button"
        onClick={() => onChange("list")}
        className={`flex h-7 w-7 items-center justify-center rounded-full text-sm transition ${
          mode === "list" ? "bg-brand-600 text-white shadow-sm" : "text-ink-muted hover:bg-surface-3"
        }`}
        aria-label="Xem dạng danh sách"
        aria-pressed={mode === "list"}
        title="Xem dạng danh sách"
      >
        ☰
      </button>
    </div>
  );
}
