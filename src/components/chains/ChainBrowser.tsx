"use client";

import { useEffect, useRef, useState } from "react";
import type { Language, SrsRating } from "@/types/vocab";
import type { ChainLanguageData, ChainNode, ClusterMemberWord, WordChain, WordCluster } from "@/types/chain";
import { localeForLanguage, speak, speakAndWait, ttsFailureMessage, VI_LOCALE } from "@/lib/tts";
import { useFullscreen } from "@/lib/useFullscreen";
import { loadProgress, rateWord, toggleBookmark, toggleMastered } from "@/lib/progress";
import { RATING_LABELS } from "@/lib/srs";
import ViewModeToggle, { type ViewMode } from "@/components/ui/ViewModeToggle";
import BrowserTabs from "@/components/ui/BrowserTabs";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTieChar(node: ChainNode, chars: string[], index: number): boolean {
  if (index === 0 && node.sharedCharPrev && chars[0] === node.sharedCharPrev) return true;
  if (index === chars.length - 1 && node.sharedCharNext && chars[chars.length - 1] === node.sharedCharNext)
    return true;
  return false;
}

/** Rút gọn chuỗi thành 3 từ đại diện (đầu, giữa, cuối) để hiện trên dòng tóm tắt — tránh liệt kê hết
 * khi chuỗi dài, gây rối mắt trên danh sách chính. */
function previewWords(chain: WordChain): string {
  const words = chain.nodes.map((n) => n.headword);
  if (words.length <= 3) return words.join(" → ");
  return `${words[0]} → ⋯ → ${words[words.length - 1]}`;
}

function NodeTile({
  node,
  active,
  large,
  onToggle,
}: {
  node: ChainNode;
  active: boolean;
  large: boolean;
  onToggle: () => void;
}) {
  const chars = Array.from(node.headword);
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex overflow-hidden rounded-xl border-2 bg-surface-2 shadow-sm transition hover:border-amber-400 hover:-translate-y-0.5 ${
        active ? "border-amber-500 ring-2 ring-amber-200" : "border-border-strong"
      }`}
    >
      {chars.map((ch, i) => (
        <span
          key={i}
          className={`font-medium leading-none ${large ? "px-4 py-3 text-3xl" : "px-3 py-2 text-xl"} ${
            i > 0 ? "border-l border-dashed border-border" : ""
          } ${isTieChar(node, chars, i) ? "text-accent-600" : "text-ink"}`}
        >
          {ch}
        </span>
      ))}
    </button>
  );
}

function JointPin({ char, large }: { char: string; large: boolean }) {
  return (
    <div className={`flex flex-none items-center ${large ? "w-14" : "w-11"}`} aria-hidden>
      <span className="h-0.5 flex-1 bg-border-strong" />
      <span
        className={`flex flex-none items-center justify-center rounded-full border-2 border-surface-2 bg-accent-500 font-bold text-white shadow ${
          large ? "h-8 w-8 text-sm" : "h-6 w-6 text-xs"
        }`}
      >
        {char}
      </span>
      <span className="h-0.5 flex-1 bg-border-strong" />
    </div>
  );
}

function positionLabel(node: ChainNode): string {
  const prev = node.sharedCharPrev ? `nối trước qua ${node.sharedCharPrev}` : "đầu chuỗi";
  const next = node.sharedCharNext ? `nối sau qua ${node.sharedCharNext}` : "cuối chuỗi";
  return `${prev} · ${next}`;
}

/** Nút tròn dùng chung cho thanh công cụ toàn màn hình (zoom, điều hướng, thoát...). */
function ToolButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-border bg-surface-2 text-sm text-ink hover:border-amber-300 hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-40"
      aria-label={label}
    >
      {children}
    </button>
  );
}

/** Cụm nút chấm điểm SRS + đánh dấu đã thuộc + yêu thích — dùng chung cho cả chuỗi nối đuôi lẫn chùm
 * quanh 1 từ, khoá theo `itemId` (chain.id / cluster.id) trong cùng kho tiến trình `/api/progress`
 * vốn đã tổng quát theo `wordId` bất kỳ chuỗi nào, không riêng cho từ vựng đơn lẻ. */
function ProgressControls({
  itemId,
  isBookmarked,
  isMastered,
  isRating,
  onToggleBookmark,
  onToggleMastered,
  onRate,
}: {
  itemId: string;
  isBookmarked: boolean;
  isMastered: boolean;
  isRating: boolean;
  onToggleBookmark: () => void;
  onToggleMastered: () => void;
  onRate: (rating: SrsRating) => void;
}) {
  return (
    <div className="mt-4 rounded-xl border border-border bg-surface-3/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-ink-muted">Mức độ nhớ</span>
        <button
          type="button"
          onClick={onToggleBookmark}
          className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
            isBookmarked
              ? "border-amber-400 bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
              : "border-border bg-surface-2 text-ink-muted hover:border-amber-300"
          }`}
          aria-label={isBookmarked ? "Bỏ đánh dấu yêu thích" : "Đánh dấu yêu thích"}
        >
          {isBookmarked ? "★ Yêu thích" : "☆ Yêu thích"}
        </button>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {([0, 1, 2, 3] as SrsRating[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => onRate(r)}
            disabled={isRating}
            className={`rounded-full px-2 py-2 text-xs font-semibold text-white shadow-sm transition disabled:opacity-50 ${
              [
                "bg-red-500 hover:bg-red-600",
                "bg-orange-500 hover:bg-orange-600",
                "bg-blue-500 hover:bg-blue-600",
                "bg-green-500 hover:bg-green-600",
              ][r]
            }`}
          >
            {RATING_LABELS[r]}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onToggleMastered}
        className="mt-2 w-full text-center text-xs font-medium text-green-600 underline decoration-dotted hover:text-green-700"
      >
        {isMastered ? "↩️ Bỏ đánh dấu đã thuộc" : "✅ Đã thuộc kỹ rồi — bỏ qua trong ôn tập"}
      </button>
      <span className="sr-only">{itemId}</span>
    </div>
  );
}

function ChainDetailPanel({
  chain,
  language,
  zoom,
  highlightIndex,
}: {
  chain: WordChain;
  language: Language;
  zoom: number;
  /** Khi chế độ tự động đọc đang chạy, cha truyền chỉ số mắt xích đang đọc vào đây để đồng bộ ô đang
   * mở + cuộn tới đúng vị trí — không dùng thì component tự quản lý bằng click thủ công như cũ. */
  highlightIndex?: number;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const activeTileRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (highlightIndex !== undefined) setOpenIndex(highlightIndex);
  }, [highlightIndex]);

  useEffect(() => {
    activeTileRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [openIndex]);

  async function handleSpeak(node: ChainNode) {
    setTtsError(null);
    const result = await speak(node.headword, language);
    if (!result.ok) setTtsError(ttsFailureMessage(result.reason));
  }

  const openNode = openIndex !== null ? chain.nodes[openIndex] : undefined;

  return (
    <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
      <div className="flex flex-1 flex-col items-center justify-center overflow-auto p-6 sm:p-10">
        <div style={{ zoom }}>
          <div className="flex flex-wrap items-start justify-center gap-y-6">
            {chain.nodes.map((node, i) => (
              <div key={i} className="flex items-start" ref={openIndex === i ? activeTileRef : undefined}>
                <div className="flex flex-col items-center gap-1.5">
                  <NodeTile
                    node={node}
                    large
                    active={openIndex === i}
                    onToggle={() => setOpenIndex(openIndex === i ? null : i)}
                  />
                  <span className="whitespace-nowrap text-sm text-ink-muted">
                    {node.reading} — {node.meaningVn}
                  </span>
                </div>
                {i < chain.nodes.length - 1 && node.sharedCharNext && (
                  <div className="pt-4">
                    <JointPin char={node.sharedCharNext} large />
                  </div>
                )}
              </div>
            ))}
          </div>

          <p className="mt-4 text-center text-sm text-ink-muted">{chain.note}</p>
        </div>
      </div>

      {openNode && (
        <div className="w-full flex-none overflow-auto border-t border-border p-5 lg:h-full lg:w-96 lg:border-t-0 lg:border-l">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-medium text-ink">{openNode.headword}</span>
            {openNode.hanja && <span className="text-sm text-ink-muted">({openNode.hanja})</span>}
            <button
              type="button"
              onClick={() => handleSpeak(openNode)}
              className="ml-auto flex h-8 w-8 flex-none items-center justify-center rounded-full border border-border-strong bg-surface-2 text-sm hover:bg-brand-50"
              aria-label="Phát âm"
            >
              🔊
            </button>
            <button
              type="button"
              onClick={() => setOpenIndex(null)}
              className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-border bg-surface-2 text-sm text-ink-muted hover:bg-surface-3"
              aria-label="Đóng"
            >
              ✕
            </button>
          </div>
          <p className="mt-1 text-sm italic text-brand-600">{openNode.reading}</p>
          <span className="mt-1 inline-block rounded bg-surface-3 px-2 py-0.5 text-[11px] font-bold text-ink-muted">
            Hán Việt: {openNode.hanViet}
          </span>
          <dl className="mt-3 flex flex-col gap-2 text-[13px]">
            <div className="flex gap-2">
              <dt className="w-16 flex-none font-semibold text-ink-muted">Nghĩa</dt>
              <dd className="text-ink">{openNode.meaningVn}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 flex-none font-semibold text-ink-muted">Vị trí</dt>
              <dd className="text-ink">{positionLabel(openNode)}</dd>
            </div>
          </dl>
          {ttsError && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{ttsError}</p>}
        </div>
      )}
    </div>
  );
}

function ClusterWordCard({
  word,
  language,
  active,
}: {
  word: ClusterMemberWord;
  language: Language;
  active?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [active]);

  async function handleSpeak() {
    setError(null);
    const result = await speak(word.headword, language);
    if (!result.ok) setError(ttsFailureMessage(result.reason));
  }
  return (
    <div
      ref={ref}
      className={`rounded-xl border px-3.5 py-2.5 shadow-sm transition ${
        active ? "border-amber-500 bg-surface-2 ring-2 ring-amber-200" : "border-border-strong bg-surface-2"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="hanzi text-lg font-medium text-ink">{word.headword}</span>
        {word.hanja && <span className="text-xs text-ink-muted">({word.hanja})</span>}
        <span className="text-xs italic text-brand-600">{word.reading}</span>
        <button
          type="button"
          onClick={handleSpeak}
          className="ml-auto flex h-6 w-6 flex-none items-center justify-center rounded-full border border-border bg-surface-3 text-[11px] hover:bg-brand-50"
          aria-label="Phát âm"
        >
          🔊
        </button>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        <span className="font-semibold text-ink">{word.hanViet}</span> — {word.meaningVn}
      </p>
      {error && <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

function ClusterDetailPanel({
  cluster,
  language,
  zoom,
  highlightIndex,
}: {
  cluster: WordCluster;
  language: Language;
  zoom: number;
  highlightIndex?: number;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-auto p-6 sm:p-10">
      <div style={{ zoom }} className="flex flex-col items-center gap-4">
        <div className="rounded-2xl bg-brand-600 px-6 py-3 text-center text-white shadow">
          <div className="hanzi text-3xl">{cluster.centerChar}</div>
          <div className="mt-0.5 text-xs opacity-90">
            {cluster.centerReading} · {cluster.centerHanViet}
          </div>
        </div>
        <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
          {cluster.words.map((w, i) => (
            <ClusterWordCard key={i} word={w} language={language} active={highlightIndex === i} />
          ))}
        </div>
        <p className="text-center text-sm text-ink-muted">{cluster.note}</p>
      </div>
    </div>
  );
}

function ChainCard({ chain, layout, onOpen }: { chain: WordChain; layout: ViewMode; onOpen: () => void }) {
  if (layout === "grid") {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex h-full w-full flex-col items-start gap-2 rounded-2xl border border-border bg-surface-2 p-3 text-left shadow-sm transition hover:border-amber-300 hover:shadow-md"
      >
        <span className="hanzi line-clamp-2 text-sm font-medium text-ink">{previewWords(chain)}</span>
        <span className="mt-auto flex w-full items-center justify-between gap-2">
          <span className="rounded-md bg-surface-3 px-2 py-0.5 text-[10px] font-bold text-ink-muted">
            {chain.nodes.length} mắt xích
          </span>
          <span className="flex-none text-amber-500">⛶</span>
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3 text-left shadow-sm transition hover:border-amber-300 hover:shadow-md"
    >
      <span className="hanzi flex-1 truncate text-base font-medium text-ink">{previewWords(chain)}</span>
      <span className="flex-none rounded-md bg-surface-3 px-2 py-0.5 text-[10px] font-bold text-ink-muted">
        {chain.nodes.length} mắt xích
      </span>
      <span className="flex-none text-amber-500">⛶</span>
    </button>
  );
}

function ClusterCard({ cluster, layout, onOpen }: { cluster: WordCluster; layout: ViewMode; onOpen: () => void }) {
  const preview = cluster.words.map((w) => w.headword).join(" · ");
  if (layout === "grid") {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex h-full w-full flex-col items-start gap-2 rounded-2xl border border-border bg-surface-2 p-3 text-left shadow-sm transition hover:border-amber-300 hover:shadow-md"
      >
        <span className="flex-none rounded-full bg-brand-600 px-2.5 py-1 text-sm font-bold text-white">
          {cluster.centerChar}
        </span>
        <span className="hanzi line-clamp-2 text-sm font-medium text-ink">{preview}</span>
        <span className="mt-auto flex w-full items-center justify-between gap-2">
          <span className="rounded-md bg-surface-3 px-2 py-0.5 text-[10px] font-bold text-ink-muted">chùm</span>
          <span className="flex-none text-amber-500">⛶</span>
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3 text-left shadow-sm transition hover:border-amber-300 hover:shadow-md"
    >
      <span className="flex-none rounded-full bg-brand-600 px-2.5 py-1 text-sm font-bold text-white">
        {cluster.centerChar}
      </span>
      <span className="hanzi flex-1 truncate text-base font-medium text-ink">{preview}</span>
      <span className="flex-none rounded-md bg-surface-3 px-2 py-0.5 text-[10px] font-bold text-ink-muted">chùm</span>
      <span className="flex-none text-amber-500">⛶</span>
    </button>
  );
}

type ChainTab = "chains" | "clusters";
type OpenItem = { kind: ChainTab; index: number };

export default function ChainBrowser({ language, data }: { language: Language; data: ChainLanguageData }) {
  const hasClusters = !!data.clusters && data.clusters.length > 0;
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [activeTab, setActiveTab] = useState<ChainTab>("chains");
  const [openItem, setOpenItem] = useState<OpenItem | null>(null);
  const [zoom, setZoom] = useState(1);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set());
  const [ratingId, setRatingId] = useState<string | null>(null);
  const [autoPlaying, setAutoPlaying] = useState(false);
  const [autoPlayWordIndex, setAutoPlayWordIndex] = useState<number | null>(null);
  const [repeatCount, setRepeatCount] = useState(3);
  const [autoMarkHard, setAutoMarkHard] = useState(false);
  const autoPlayCancelRef = useRef(false);

  const { containerRef, isFullscreen, enterFullscreen, exitFullscreen, fullscreenClassName } =
    useFullscreen<HTMLDivElement>();

  useEffect(() => {
    let cancelled = false;
    loadProgress().then((progress) => {
      if (cancelled) return;
      const bookmarked = Object.entries(progress)
        .filter(([, p]) => p.bookmarked)
        .map(([id]) => id);
      setBookmarkedIds(new Set(bookmarked));
      const mastered = Object.entries(progress)
        .filter(([, p]) => p.mastered)
        .map(([id]) => id);
      setMasteredIds(new Set(mastered));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isFullscreen) setZoom(1);
  }, [isFullscreen]);

  const list = openItem?.kind === "chains" ? data.chains : data.clusters ?? [];
  const currentId =
    openItem && (openItem.kind === "chains" ? data.chains[openItem.index]?.id : data.clusters?.[openItem.index]?.id);

  /** Số lượng phần tử trong danh sách của 1 `OpenItem` cụ thể (không phải `openItem` hiện tại) — dùng
   * khi vòng lặp tự động đọc cần biết còn chuỗi/cụm tiếp theo hay không mà không phụ thuộc state. */
  function lengthFor(item: OpenItem): number {
    return item.kind === "chains" ? data.chains.length : data.clusters?.length ?? 0;
  }

  function idFor(item: OpenItem): string | undefined {
    return item.kind === "chains" ? data.chains[item.index]?.id : data.clusters?.[item.index]?.id;
  }

  /** Danh sách {từ, nghĩa} của 1 `OpenItem` cụ thể — dùng chung cho cả chuỗi nối đuôi (mỗi mắt xích) và
   * chùm quanh 1 từ (mỗi từ thành viên), để vòng lặp tự động đọc không cần biết đang ở tab nào. Nhận
   * tham số `item` tường minh (mặc định `openItem`) vì vòng lặp tự động sang chuỗi/cụm kế tiếp cần đọc
   * danh sách từ của chuỗi/cụm SẮP mở, trước khi state `openItem` kịp cập nhật. */
  function wordsFor(item: OpenItem | null): { headword: string; meaningVn: string }[] {
    if (!item) return [];
    if (item.kind === "chains") {
      return data.chains[item.index]?.nodes.map((n) => ({ headword: n.headword, meaningVn: n.meaningVn })) ?? [];
    }
    return data.clusters?.[item.index]?.words.map((w) => ({ headword: w.headword, meaningVn: w.meaningVn })) ?? [];
  }

  function currentWords(): { headword: string; meaningVn: string }[] {
    return wordsFor(openItem);
  }

  function stopAutoPlay() {
    autoPlayCancelRef.current = true;
    setAutoPlaying(false);
    setAutoPlayWordIndex(null);
    if (isTtsSupportedHere()) window.speechSynthesis.cancel();
  }

  function isTtsSupportedHere(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  /** Vòng lặp tự động đọc: đọc TỪ GỐC lặp `repeatCount` lần, xen 1 lần đọc nghĩa tiếng Việt ngay sau
   * lượt đọc từ gốc ĐẦU TIÊN (không đọc nghĩa lặp lại nhiều lần như bản cũ) → qua từ kế tiếp. Đọc hết
   * 1 chuỗi/cụm thì (nếu bật `autoMarkHard`) tự động gắn mức độ nhớ "Khó" cho CẢ chuỗi/cụm đó — vì đây
   * là nghe thụ động, không chủ động tự kiểm tra, nên mặc định coi là "chưa nhớ chắc" giống Anki khi
   * chỉ nghe không trả lời — rồi tự động mở chuỗi/cụm kế tiếp trong cùng danh sách và tiếp tục đọc,
   * dừng hẳn khi hết danh sách. Dừng ngay ở bất kỳ bước nào khi `autoPlayCancelRef` bật (người dùng bấm
   * Dừng, next/prev thủ công, đóng toàn màn hình, hoặc unmount). Nếu máy không có giọng đọc phù hợp,
   * `speakAndWait` trả về `ok:false` gần như ngay lập tức — thêm khoảng nghỉ cố định để nhịp đọc vẫn
   * hợp lý cho người dùng theo dõi bằng mắt, không lướt qua các từ quá nhanh khi im lặng. */
  async function startAutoPlay() {
    if (!openItem) return;
    autoPlayCancelRef.current = false;
    setAutoPlaying(true);
    const targetLocale = localeForLanguage(language);
    let cursor: OpenItem | null = openItem;

    while (cursor) {
      const words = wordsFor(cursor);
      for (let i = 0; i < words.length; i++) {
        if (autoPlayCancelRef.current) return;
        setAutoPlayWordIndex(i);
        for (let r = 0; r < repeatCount; r++) {
          if (autoPlayCancelRef.current) return;
          const wordResult = await speakAndWait(words[i].headword, targetLocale);
          if (!wordResult.ok) await sleep(900);
          if (r === 0) {
            if (autoPlayCancelRef.current) return;
            const meaningResult = await speakAndWait(words[i].meaningVn, VI_LOCALE);
            if (!meaningResult.ok) await sleep(1200);
          }
        }
      }
      if (autoPlayCancelRef.current) return;

      if (autoMarkHard) {
        const id = idFor(cursor);
        if (id) handleRate(id, 1); // 1 = "Khó" — không await để không làm chậm nhịp tự động next.
      }

      const total = lengthFor(cursor);
      if (cursor.index + 1 >= total) break; // hết danh sách, dừng tự động
      cursor = { ...cursor, index: cursor.index + 1 };
      setOpenItem(cursor);
    }

    if (!autoPlayCancelRef.current) {
      setAutoPlaying(false);
      setAutoPlayWordIndex(null);
    }
  }

  function toggleAutoPlay() {
    if (autoPlaying) stopAutoPlay();
    else startAutoPlay();
  }

  useEffect(() => {
    // Dừng vòng lặp đọc nếu component bị gỡ khi đang chạy (chuyển trang, đóng tab...).
    return () => {
      autoPlayCancelRef.current = true;
      if (isTtsSupportedHere()) window.speechSynthesis.cancel();
    };
  }, []);

  function openAt(kind: ChainTab, index: number) {
    stopAutoPlay();
    setOpenItem({ kind, index });
    enterFullscreen();
  }

  function closeDetail() {
    stopAutoPlay();
    exitFullscreen();
    setOpenItem(null);
  }

  function step(delta: number) {
    stopAutoPlay();
    setOpenItem((cur) => {
      if (!cur) return cur;
      const len = cur.kind === "chains" ? data.chains.length : data.clusters?.length ?? 0;
      const next = Math.min(len - 1, Math.max(0, cur.index + delta));
      return { ...cur, index: next };
    });
  }

  async function handleToggleBookmark(id: string) {
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    try {
      await toggleBookmark(id);
    } catch {
      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
  }

  async function handleToggleMastered(id: string) {
    setMasteredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    try {
      await toggleMastered(id);
    } catch {
      setMasteredIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
  }

  async function handleRate(id: string, rating: SrsRating) {
    if (ratingId) return;
    setRatingId(id);
    try {
      await rateWord(id, rating);
    } catch {
      // im lặng bỏ qua — không chặn thao tác xem chuỗi chỉ vì lưu điểm thất bại
    } finally {
      setRatingId(null);
    }
  }

  const listClass = viewMode === "grid" ? "grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-2";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {hasClusters ? (
          <BrowserTabs
            tabs={[
              { id: "chains", label: "🔗 Nối đuôi", count: data.chains.length },
              { id: "clusters", label: "Chuỗi quanh 1 từ", count: data.clusters!.length },
            ]}
            activeId={activeTab}
            onChange={setActiveTab}
          />
        ) : (
          <span />
        )}
        <ViewModeToggle mode={viewMode} onChange={setViewMode} />
      </div>

      {(!hasClusters || activeTab === "chains") && (
        <div className={listClass}>
          {data.chains.map((chain, i) => (
            <div key={chain.id} className="relative h-full">
              {bookmarkedIds.has(chain.id) && (
                <span className="absolute right-2 top-2 z-10 text-amber-500" aria-hidden>
                  ★
                </span>
              )}
              {masteredIds.has(chain.id) && (
                <span className="absolute left-2 top-2 z-10 text-emerald-500" aria-hidden>
                  ✅
                </span>
              )}
              <ChainCard chain={chain} layout={viewMode} onOpen={() => openAt("chains", i)} />
            </div>
          ))}
        </div>
      )}

      {hasClusters && activeTab === "clusters" && (
        <div className={listClass}>
          {data.clusters!.map((cluster, i) => (
            <div key={cluster.id} className="relative h-full">
              {bookmarkedIds.has(cluster.id) && (
                <span className="absolute right-2 top-2 z-10 text-amber-500" aria-hidden>
                  ★
                </span>
              )}
              {masteredIds.has(cluster.id) && (
                <span className="absolute left-2 top-2 z-10 text-emerald-500" aria-hidden>
                  ✅
                </span>
              )}
              <ClusterCard cluster={cluster} layout={viewMode} onOpen={() => openAt("clusters", i)} />
            </div>
          ))}
        </div>
      )}

      {isFullscreen && openItem && currentId && (
        <div ref={containerRef} className={`flex h-full flex-col overflow-hidden bg-surface ${fullscreenClassName}`}>
          <div className="flex items-center justify-between gap-2 border-b border-border px-6 py-3 sm:px-10">
            <div className="flex min-w-0 items-center gap-2">
              <ToolButton onClick={() => step(-1)} disabled={openItem.index === 0} label="Cụm trước">
                ‹
              </ToolButton>
              <span className="whitespace-nowrap text-xs text-ink-muted">
                {openItem.index + 1} / {list.length}
              </span>
              <ToolButton onClick={() => step(1)} disabled={openItem.index === list.length - 1} label="Cụm sau">
                ›
              </ToolButton>
              <span className="ml-2 truncate font-mono text-xs text-ink-muted">{currentId}</span>
            </div>
            <div className="flex flex-none items-center gap-1">
              {openItem.kind === "chains" && (
                <span className="mr-1 rounded-md bg-surface-3 px-2 py-0.5 text-[11px] font-bold text-ink-muted">
                  {data.chains[openItem.index].nodes.length} mắt xích
                </span>
              )}
              <ToolButton onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))} label="Thu nhỏ">
                −
              </ToolButton>
              <span className="w-11 text-center text-xs text-ink-muted">{Math.round(zoom * 100)}%</span>
              <ToolButton onClick={() => setZoom((z) => Math.min(1.8, +(z + 0.1).toFixed(2)))} label="Phóng to">
                +
              </ToolButton>
              <ToolButton onClick={() => setZoom(1)} label="Về cỡ gốc">
                ⟲
              </ToolButton>
              <ToolButton onClick={closeDetail} label="Thoát toàn màn hình">
                ⤢
              </ToolButton>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-3/40 px-6 py-2 sm:px-10">
            <button
              type="button"
              onClick={toggleAutoPlay}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
                autoPlaying
                  ? "border-red-400 bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                  : "border-brand-400 bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-950/30 dark:text-brand-300"
              }`}
            >
              {autoPlaying ? "⏸ Dừng đọc" : "▶️ Tự động đọc"}
            </button>
            <div className="flex items-center gap-1.5 text-xs text-ink-muted">
              <span>Lặp từ gốc:</span>
              <ToolButton
                onClick={() => setRepeatCount((c) => Math.max(1, c - 1))}
                disabled={autoPlaying}
                label="Giảm số lần lặp"
              >
                −
              </ToolButton>
              <span className="w-4 text-center font-semibold text-ink">{repeatCount}</span>
              <ToolButton
                onClick={() => setRepeatCount((c) => Math.min(6, c + 1))}
                disabled={autoPlaying}
                label="Tăng số lần lặp"
              >
                +
              </ToolButton>
            </div>
            <button
              type="button"
              onClick={() => setAutoMarkHard((v) => !v)}
              disabled={autoPlaying}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                autoMarkHard
                  ? "border-orange-400 bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"
                  : "border-border bg-surface-2 text-ink-muted hover:border-orange-300"
              }`}
              aria-pressed={autoMarkHard}
              title="Khi đọc xong 1 chuỗi/cụm, tự động gắn mức độ nhớ 'Khó' cho chuỗi/cụm đó (chỉ nghe thụ động nên mặc định coi là chưa nhớ chắc)"
            >
              {autoMarkHard ? "☑" : "☐"} Tự động đánh dấu Khó khi nghe
            </button>
            {autoPlaying && autoPlayWordIndex !== null && (
              <span className="text-xs text-ink-muted">
                Đang đọc {autoPlayWordIndex + 1}/{currentWords().length}…
              </span>
            )}
          </div>

          <div className="flex flex-1 flex-col overflow-hidden">
            {openItem.kind === "chains" ? (
              <ChainDetailPanel
                key={currentId}
                chain={data.chains[openItem.index]}
                language={language}
                zoom={zoom}
                highlightIndex={autoPlaying ? autoPlayWordIndex ?? undefined : undefined}
              />
            ) : (
              <ClusterDetailPanel
                key={currentId}
                cluster={data.clusters![openItem.index]}
                language={language}
                zoom={zoom}
                highlightIndex={autoPlaying ? autoPlayWordIndex ?? undefined : undefined}
              />
            )}
          </div>

          <div className="border-t border-border px-6 py-3 sm:px-10">
            <div className="mx-auto max-w-2xl">
              <ProgressControls
                itemId={currentId}
                isBookmarked={bookmarkedIds.has(currentId)}
                isMastered={masteredIds.has(currentId)}
                isRating={ratingId === currentId}
                onToggleBookmark={() => handleToggleBookmark(currentId)}
                onToggleMastered={() => handleToggleMastered(currentId)}
                onRate={(r) => handleRate(currentId, r)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
