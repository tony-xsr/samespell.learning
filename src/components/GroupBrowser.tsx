"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import BrowserTabs from "@/components/ui/BrowserTabs";
import { formatAdded, isRecent, type GroupSummary } from "@/lib/groupSummary";
import { LEVEL_SCALE, levelClass } from "@/lib/levels";
import type { Language } from "@/types/vocab";

type TabId = "all" | "new" | "unlearned" | "learned" | "mine";
type SortId = "category" | "newest" | "az" | "most" | "fewest";
type ViewId = "grid" | "list" | "bubble";

const MAX_CHIPS = 6;
const UNCATEGORIZED = "Khác";

const SORT_LABELS: Record<SortId, string> = {
  category: "Theo chủ đề",
  newest: "Mới thêm nhất",
  az: "A → Z",
  most: "Nhiều từ nhất",
  // Chiều ngược lại của "most". Có hai lý do thật để cần nó: nhóm ít từ là nhóm học nhanh xong,
  // và cũng chính là nhóm còn thiếu dữ liệu cần bổ sung — trước đây không có cách nào tìm ra.
  fewest: "Ít từ nhất",
};

function slugify(text: string) {
  return "cat-" + text.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase();
}

function NewBadge({ addedAt }: { addedAt?: string }) {
  if (!isRecent(addedAt)) return null;
  return (
    <span
      title={"Mindmap mới thêm " + formatAdded(addedAt)}
      className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
    >
      MỚI
    </span>
  );
}

function MineBadge({ userAdded }: { userAdded: boolean }) {
  if (!userAdded) return null;
  return (
    <span
      title="Có nội dung do bạn tự thêm (không nằm trong dữ liệu soạn sẵn)"
      className="shrink-0 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
    >
      ✚ TỰ THÊM
    </span>
  );
}

function LearnedBadge({ learned }: { learned: boolean }) {
  if (!learned) return null;
  return (
    <span
      title="Đã đánh dấu học xong mindmap này"
      className="shrink-0 rounded-full bg-emerald-100 px-1.5 text-xs text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
    >
      ✅
    </span>
  );
}

export default function GroupBrowser({
  groups,
  basePath,
  categoryOrder,
  language,
}: {
  groups: GroupSummary[];
  language: Language;
  /** Tiền tố đường dẫn tới 1 mindmap, vd "/shapes/ko" → href = "/shapes/ko/<id>". */
  basePath: string;
  /** Thứ tự chủ đề do trang quyết định (mỗi trục ghim chủ đề khác nhau lên đầu/xuống cuối). */
  categoryOrder: string[];
}) {
  const [tab, setTab] = useState<TabId>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortId>("category");
  const [view, setView] = useState<ViewId>("grid");
  const [level, setLevel] = useState("");
  /** Mục chủ đề nào người dùng đã TỰ bấm gập/mở, lưu theo tên chủ đề.
   *
   * Trước đây `<details>` dùng thẳng `open={i === 0 || list.length <= 30}`. Vì đó là một biểu thức
   * tính lại mỗi lần render, nên hễ người dùng chạm vào bất kỳ bộ lọc nào (chip trình độ, tab, ô tìm
   * kiếm) là `list.length` đổi → React thấy giá trị `open` đổi và ÉP thẻ về trạng thái máy tự quyết,
   * xoá sạch lựa chọn vừa rồi. Người dùng mở một mục ra, bấm bộ lọc, mục tự đóng lại — nhìn như mục
   * "biến mất" và không có cách nào giữ nó mở.
   *
   * Nay biểu thức kia chỉ còn là GIÁ TRỊ MẶC ĐỊNH cho mục chưa từng được chạm tới; đã chạm thì ý
   * người dùng thắng và giữ nguyên qua mọi lần lọc. */
  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>({});

  const counts = useMemo(
    () => ({
      all: groups.length,
      new: groups.filter((g) => isRecent(g.addedAt)).length,
      unlearned: groups.filter((g) => !g.learned).length,
      learned: groups.filter((g) => g.learned).length,
      mine: groups.filter((g) => g.userAdded).length,
    }),
    [groups],
  );

  /** Chỉ hiện dãy chip trình độ khi kho này THỰC SỰ đã được gắn nhãn, kèm số nhóm của từng mức. Phần
   * lớn nội dung soạn sẵn chưa gắn (xem Features.md mục 27) — bày ra dãy chip toàn số 0 chỉ làm người
   * dùng tưởng hỏng. */
  const levelChips = useMemo(() => {
    const scale = LEVEL_SCALE[language]?.values ?? [];
    return scale
      .map((v) => ({ value: v, count: groups.filter((g) => g.levels.includes(v)).length }))
      .filter((c) => c.count > 0);
  }, [groups, language]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = groups;
    if (level) out = out.filter((g) => g.levels.includes(level));
    if (tab === "new") out = out.filter((g) => isRecent(g.addedAt));
    else if (tab === "unlearned") out = out.filter((g) => !g.learned);
    else if (tab === "learned") out = out.filter((g) => g.learned);
    else if (tab === "mine") out = out.filter((g) => g.userAdded);

    if (needle) {
      out = out.filter(
        (g) =>
          g.reading.toLowerCase().includes(needle) ||
          g.chars.some((c) => c.toLowerCase().includes(needle)) ||
          (g.category ?? "").toLowerCase().includes(needle),
      );
    }

    if (sort === "newest") {
      // Nhóm chưa có addedAt xuống cuối thay vì lẫn vào giữa.
      out = [...out].sort((a, b) => (b.addedAt ?? "").localeCompare(a.addedAt ?? ""));
    } else if (sort === "az") {
      out = [...out].sort((a, b) => a.reading.localeCompare(b.reading));
    } else if (sort === "most") {
      out = [...out].sort((a, b) => b.wordCount - a.wordCount);
    } else if (sort === "fewest") {
      out = [...out].sort((a, b) => a.wordCount - b.wordCount);
    }
    return out;
  }, [groups, tab, q, sort, level]);

  const sections = useMemo(() => {
    // Kiểu bong bóng là để nhìn BAO QUÁT cả kho, nên luôn trải phẳng: gom theo chủ đề sẽ gập hết các
    // mục lớn lại và người dùng không thấy bong bóng nào — đúng thứ mà kiểu xem này sinh ra để cho thấy.
    if (sort !== "category" || view === "bubble") return null;
    const map = new Map<string, GroupSummary[]>();
    for (const g of filtered) {
      const cat = g.category ?? UNCATEGORIZED;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(g);
    }
    const rank = (c: string) => {
      const i = categoryOrder.indexOf(c);
      return i === -1 ? categoryOrder.length : i;
    };
    return [...map.entries()].sort((a, b) => rank(a[0]) - rank(b[0]));
  }, [filtered, sort, view, categoryOrder]);

  const maxWords = useMemo(() => Math.max(1, ...filtered.map((g) => g.wordCount)), [filtered]);

  function Card({ g }: { g: GroupSummary }) {
    const extra = g.rootCount - MAX_CHIPS;
    return (
      <Link
        href={`${basePath}/${g.id}`}
        className="flex flex-col rounded-2xl border border-border bg-surface-2 px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
      >
        <span className="flex items-center gap-1.5">
          <span className="text-lg font-bold text-brand-600">{g.reading}</span>
          <NewBadge addedAt={g.addedAt} />
          <LearnedBadge learned={g.learned} />
          <MineBadge userAdded={g.userAdded} />
        </span>
        <span className="mt-0.5 text-xs font-medium text-accent-600">
          {g.rootCount} chữ · {g.wordCount} từ
        </span>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {g.chars.slice(0, MAX_CHIPS).map((c, i) => (
            <span key={`${c}-${i}`} className="rounded-lg bg-surface-3 px-2 py-0.5 text-sm text-ink">
              {c}
            </span>
          ))}
          {extra > 0 && <span className="rounded-lg px-2 py-0.5 text-sm text-ink-muted">+{extra}</span>}
        </div>
      </Link>
    );
  }

  function Row({ g }: { g: GroupSummary }) {
    return (
      <Link
        href={`${basePath}/${g.id}`}
        className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 px-3 py-2 transition hover:border-brand-300 hover:bg-surface-3"
      >
        <span className="font-bold text-brand-600">{g.reading}</span>
        <NewBadge addedAt={g.addedAt} />
        <LearnedBadge learned={g.learned} />
        <MineBadge userAdded={g.userAdded} />
        <span className="truncate text-sm text-ink-muted">{g.chars.slice(0, 10).join(" ")}</span>
        <span className="ml-auto shrink-0 text-xs font-medium text-accent-600">
          {g.rootCount} chữ · {g.wordCount} từ
        </span>
      </Link>
    );
  }

  /** Bong bóng: đường kính tỉ lệ với số từ, nên "nhóm nào dày" nhìn phát ra ngay — thứ mà lưới thẻ
   * (mọi thẻ bằng nhau) không cho thấy. Căn khoảng 56–132px để nhóm nhỏ nhất vẫn bấm được. */
  function Bubble({ g }: { g: GroupSummary }) {
    const size = Math.round(56 + (g.wordCount / maxWords) * 76);
    return (
      <Link
        href={`${basePath}/${g.id}`}
        title={`${g.reading} — ${g.rootCount} chữ · ${g.wordCount} từ`}
        style={{ width: size, height: size }}
        className={`flex flex-col items-center justify-center rounded-full border-2 p-1 text-center transition hover:scale-105 ${
          g.userAdded
            ? "border-violet-400 bg-violet-100 dark:bg-violet-900/40"
            : g.learned
              ? "border-emerald-400 bg-emerald-100 dark:bg-emerald-900/40"
              : isRecent(g.addedAt)
              ? "border-amber-400 bg-amber-100 dark:bg-amber-900/40"
              : "border-border bg-surface-2 hover:border-brand-300"
        }`}
      >
        <span className="w-full truncate px-1 text-xs font-bold text-ink">{g.reading}</span>
        <span className="text-[10px] text-ink-muted">{g.wordCount} từ</span>
      </Link>
    );
  }

  function renderBatch(list: GroupSummary[]) {
    if (view === "list") {
      return (
        <div className="flex flex-col gap-1.5">
          {list.map((g) => (
            <Row key={g.id} g={g} />
          ))}
        </div>
      );
    }
    if (view === "bubble") {
      return (
        <div className="flex flex-wrap items-center gap-2">
          {list.map((g) => (
            <Bubble key={g.id} g={g} />
          ))}
        </div>
      );
    }
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {list.map((g) => (
          <Card key={g.id} g={g} />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mt-4 flex flex-col gap-3">
        <BrowserTabs<TabId>
          tabs={[
            { id: "all", label: "Tất cả", count: counts.all },
            { id: "unlearned", label: "📖 Chưa học", count: counts.unlearned },
            { id: "learned", label: "✅ Đã học", count: counts.learned },
            { id: "new", label: "🆕 Mới", count: counts.new },
            { id: "mine", label: "✚ Tự thêm", count: counts.mine },
          ]}
          activeId={tab}
          onChange={setTab}
        />

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="🔍 Tìm theo âm hoặc chữ…"
            aria-label="Tìm mindmap"
            className="min-w-0 basis-full rounded-full border border-border bg-surface-2 px-4 py-2 sm:basis-0 sm:flex-1 text-sm text-ink placeholder:text-ink-muted focus:border-brand-400 focus:outline-none"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortId)}
            aria-label="Sắp xếp"
            className="rounded-full border border-border bg-surface-2 px-3 py-2 text-sm text-ink focus:border-brand-400 focus:outline-none"
          >
            {(Object.keys(SORT_LABELS) as SortId[]).map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </select>
          <div className="flex flex-none items-center gap-1 rounded-full border border-border bg-surface-2 p-1">
            {([
              ["grid", "▦", "Xem dạng lưới"],
              ["list", "☰", "Xem dạng danh sách"],
              ["bubble", "◍", "Xem dạng bong bóng"],
            ] as [ViewId, string, string][]).map(([id, icon, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                aria-label={label}
                aria-pressed={view === id}
                title={label}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-sm transition ${
                  view === id ? "bg-brand-600 text-white shadow-sm" : "text-ink-muted hover:bg-surface-3"
                }`}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        {levelChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Trình độ</span>
            <button
              type="button"
              onClick={() => setLevel("")}
              aria-pressed={level === ""}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                level === "" ? "bg-ink text-surface" : "bg-surface-2 text-ink-muted hover:bg-surface-3"
              }`}
            >
              Tất cả
            </button>
            {levelChips.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setLevel((l) => (l === c.value ? "" : c.value))}
                aria-pressed={level === c.value}
                aria-label={`Lọc trình độ ${c.value}`}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                  level === c.value ? "ring-2 ring-brand-500" : "hover:brightness-95"
                } ${levelClass(language, c.value)}`}
              >
                {c.value} <span className="font-normal opacity-70">{c.count}</span>
              </button>
            ))}
          </div>
        )}

        <p className="text-xs text-ink-muted" aria-live="polite">
          Hiện {filtered.length}/{groups.length} mindmap
          {q.trim() && ` khớp "${q.trim()}"`}
          {level && ` ở mức ${level}`}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border-strong bg-surface-2 px-5 py-10 text-center text-sm text-ink-muted">
          Không có mindmap nào khớp. Thử xoá ô tìm kiếm hoặc chuyển sang tab “Tất cả”.
        </div>
      ) : sections && sections.length > 1 ? (
        <>
          <nav className="mt-4 flex flex-wrap gap-1.5 border-b border-border pb-4">
            {sections.map(([cat, list]) => (
              <a
                key={cat}
                href={`#${slugify(cat)}`}
                className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-ink-muted hover:bg-surface-3 hover:text-ink"
              >
                {cat}{" "}
                <span className="text-ink-muted">
                  ({list.length} nhóm · {list.reduce((s, g) => s + g.wordCount, 0)} từ)
                </span>
              </a>
            ))}
          </nav>
          {sections.map(([cat, list], i) => (
            // Mục ĐẦU luôn mở: nếu mọi mục đều lớn (zh-shape: 14 chủ đề, mục nhỏ nhất 1 nhóm nhưng
            // phần lớn >30) thì người dùng mở trang ra chỉ thấy một bức tường tiêu đề gập lại.
            <details
              key={cat}
              id={slugify(cat)}
              open={sectionOpen[cat] ?? (i === 0 || list.length <= 30)}
              className="group mt-6 scroll-mt-4"
            >
              {/* Ghi nhận ở cú BẤM trên <summary>, không phải ở sự kiện `toggle` của <details>.
                  `toggle` bắn cả khi React tự ghi thuộc tính `open` lúc lọc lại danh sách, nên nếu
                  nghe ở đó thì chính thao tác lọc sẽ tự ghi đè bản ghi và hỏng y như cũ. Cú bấm vào
                  summary thì chắc chắn là ý người dùng (bàn phím Enter/Space cũng phát ra click).
                  Lúc này `open` còn là giá trị CŨ, nên lưu giá trị đảo.

                  `preventDefault()` là BẮT BUỘC: React xả state của sự kiện click xong mới tới lượt
                  trình duyệt chạy hành vi mặc định, nên nếu để nguyên thì React đặt `open` một lần
                  rồi trình duyệt đảo thêm lần nữa — hai cái triệt tiêu nhau và cú bấm thành vô tác
                  dụng. Chặn mặc định đi thì React là nơi duy nhất quyết định trạng thái. */}
              <summary
                className="cursor-pointer list-none"
                onClick={(e) => {
                  e.preventDefault();
                  const d = (e.currentTarget as HTMLElement).parentElement as HTMLDetailsElement;
                  setSectionOpen((prev) => ({ ...prev, [cat]: !d.open }));
                }}
              >
                <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-4 py-2.5 hover:bg-surface-3">
                  <span className="text-base font-bold text-ink">{cat}</span>
                  <span className="text-sm font-medium text-ink-muted">
                    {list.length} nhóm · {list.reduce((s, g) => s + g.wordCount, 0)} từ
                  </span>
                  <span className="ml-auto text-ink-muted transition-transform group-open:rotate-90">▶</span>
                </div>
              </summary>
              <div className="mt-3">{renderBatch(list)}</div>
            </details>
          ))}
        </>
      ) : (
        <div className="mt-6">{renderBatch(filtered)}</div>
      )}
    </div>
  );
}
