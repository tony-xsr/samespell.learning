"use client";

/** Tabbar dùng chung cho các trang có 2 nhóm nội dung tách biệt (vd "nối đuôi" và "chuỗi quanh 1 từ").
 * Thay cho cách cũ là xếp cả 2 nhóm liên tiếp trong 1 danh sách dài ngăn cách bởi 1 divider — với
 * tabbar, người dùng bấm chuyển tab thay vì phải kéo/cuộn qua hết nhóm đầu mới tới nhóm sau. */
export default function BrowserTabs<T extends string>({
  tabs,
  activeId,
  onChange,
}: {
  tabs: { id: T; label: string; count: number }[];
  activeId: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-full border border-border bg-surface-2 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
            activeId === tab.id ? "bg-brand-600 text-white shadow-sm" : "text-ink-muted hover:bg-surface-3"
          }`}
          aria-pressed={activeId === tab.id}
        >
          <span className="whitespace-nowrap">{tab.label}</span>
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              activeId === tab.id ? "bg-white/20" : "bg-surface-3 text-ink-muted"
            }`}
          >
            {tab.count}
          </span>
        </button>
      ))}
    </div>
  );
}
