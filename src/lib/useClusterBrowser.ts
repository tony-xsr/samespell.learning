"use client";

import { useEffect, useRef, useState } from "react";
import type { Language, SrsRating } from "@/types/vocab";
import { localeForLanguage, speakAndWait, VI_LOCALE } from "@/lib/tts";
import { useFullscreen } from "@/lib/useFullscreen";
import { loadProgress, rateWord, toggleBookmark, toggleMastered } from "@/lib/progress";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTtsSupportedHere(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Cách trình duyệt/hook lấy dữ liệu của danh sách đang xem. Người gọi tính lại theo tab hiện tại (nếu
 * browser có nhiều tab) — trong lúc mở toàn màn hình thì tab không đổi được nên các hàm này ổn định
 * suốt phiên xem chi tiết. */
export interface ClusterBrowserAccessors {
  /** Số phần tử trong danh sách đang xem. */
  count: number;
  /** id ổn định của phần tử thứ `index` — khoá kho tiến trình `/api/progress` (chain.id / pair.id / cluster.id). */
  idAt: (index: number) => string | undefined;
  /** Danh sách {từ gốc, nghĩa tiếng Việt} của phần tử thứ `index` — cho vòng lặp tự động đọc. */
  wordsAt: (index: number) => { headword: string; meaningVn: string }[];
}

export interface ClusterBrowserApi {
  containerRef: ReturnType<typeof useFullscreen<HTMLDivElement>>["containerRef"];
  fullscreenClassName: string;
  /** Chỉ số phần tử đang mở toàn màn hình, hoặc null khi đóng. */
  openIndex: number | null;
  /** id của phần tử đang mở (undefined khi đóng). */
  currentId: string | undefined;
  /** Số phần tử của danh sách đang xem — dùng cho "i / N" và trạng thái nút ‹/›. */
  count: number;
  /** Số từ trong phần tử đang mở — dùng cho "Đang đọc i/M…". */
  currentWordCount: number;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  open: (index: number) => void;
  close: () => void;
  step: (delta: number) => void;
  autoPlaying: boolean;
  autoPlayWordIndex: number | null;
  repeatCount: number;
  setRepeatCount: React.Dispatch<React.SetStateAction<number>>;
  autoMarkHard: boolean;
  setAutoMarkHard: React.Dispatch<React.SetStateAction<boolean>>;
  toggleAutoPlay: () => void;
  bookmarkedIds: Set<string>;
  masteredIds: Set<string>;
  ratingId: string | null;
  handleToggleBookmark: (id: string) => void;
  handleToggleMastered: (id: string) => void;
  handleRate: (id: string, rating: SrsRating) => void;
}

/** State + logic dùng chung cho các trang "browser" có thẻ mở toàn màn hình: điều hướng ‹/›, phóng to,
 * tự động đọc (đọc TỪ GỐC lặp `repeatCount` lần + đọc nghĩa 1 lần sau lượt đầu → tự sang phần tử kế),
 * tuỳ chọn tự gắn "Khó" khi nghe xong, và cụm nút tiến trình (yêu thích / chấm điểm SRS / đã thuộc)
 * khoá theo id phần tử trong kho `/api/progress` vốn tổng quát theo `wordId` bất kỳ.
 *
 * Tách từ `ChainBrowser` để `SynonymAntonymBrowser` và `CharAntonymBrowser` dùng lại cùng một hành vi. */
export function useClusterBrowser(language: Language, accessors: ClusterBrowserAccessors): ClusterBrowserApi {
  // Giữ accessor mới nhất trong ref để vòng lặp tự động đọc (async, chạy dài qua nhiều lần re-render)
  // luôn đọc đúng dữ liệu hiện tại kể cả khi danh sách đổi.
  const accessorsRef = useRef(accessors);
  accessorsRef.current = accessors;

  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set());
  const [ratingId, setRatingId] = useState<string | null>(null);
  const [autoPlaying, setAutoPlaying] = useState(false);
  const [autoPlayWordIndex, setAutoPlayWordIndex] = useState<number | null>(null);
  const [repeatCount, setRepeatCount] = useState(3);
  const [autoMarkHard, setAutoMarkHard] = useState(false);
  const autoPlayCancelRef = useRef(false);
  const ratingIdRef = useRef<string | null>(null);

  const { containerRef, isFullscreen, enterFullscreen, exitFullscreen, fullscreenClassName } =
    useFullscreen<HTMLDivElement>();

  useEffect(() => {
    let cancelled = false;
    loadProgress().then((progress) => {
      if (cancelled) return;
      setBookmarkedIds(
        new Set(
          Object.entries(progress)
            .filter(([, p]) => p.bookmarked)
            .map(([id]) => id),
        ),
      );
      setMasteredIds(
        new Set(
          Object.entries(progress)
            .filter(([, p]) => p.mastered)
            .map(([id]) => id),
        ),
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isFullscreen) setZoom(1);
  }, [isFullscreen]);

  useEffect(() => {
    // Dừng vòng lặp đọc nếu component bị gỡ khi đang chạy (chuyển trang, đóng tab...).
    return () => {
      autoPlayCancelRef.current = true;
      if (isTtsSupportedHere()) window.speechSynthesis.cancel();
    };
  }, []);

  const currentId = openIndex !== null ? accessors.idAt(openIndex) : undefined;
  const currentWordCount = openIndex !== null ? accessors.wordsAt(openIndex).length : 0;

  function stopAutoPlay() {
    autoPlayCancelRef.current = true;
    setAutoPlaying(false);
    setAutoPlayWordIndex(null);
    if (isTtsSupportedHere()) window.speechSynthesis.cancel();
  }

  async function handleRate(id: string, rating: SrsRating) {
    if (ratingIdRef.current) return;
    ratingIdRef.current = id;
    setRatingId(id);
    try {
      await rateWord(id, rating);
    } catch {
      // im lặng bỏ qua — không chặn thao tác xem chỉ vì lưu điểm thất bại
    } finally {
      ratingIdRef.current = null;
      setRatingId(null);
    }
  }

  /** Vòng lặp tự động đọc: đọc TỪ GỐC lặp `repeatCount` lần, xen 1 lần đọc nghĩa tiếng Việt ngay sau
   * lượt đọc từ gốc ĐẦU TIÊN → qua từ kế tiếp. Đọc hết 1 phần tử thì (nếu bật `autoMarkHard`) tự gắn
   * mức độ nhớ "Khó" cho cả phần tử đó — vì đây là nghe thụ động, không chủ động tự kiểm tra, nên mặc
   * định coi là "chưa nhớ chắc" giống Anki khi chỉ nghe không trả lời — rồi tự mở phần tử kế tiếp trong
   * cùng danh sách và tiếp tục đọc, dừng hẳn khi hết danh sách. Dừng ngay ở bất kỳ bước nào khi
   * `autoPlayCancelRef` bật (bấm Dừng, next/prev thủ công, đóng toàn màn hình, hoặc unmount). Nếu máy
   * không có giọng đọc phù hợp, `speakAndWait` trả về `ok:false` gần như ngay — thêm khoảng nghỉ cố
   * định để nhịp đọc vẫn hợp lý cho người theo dõi bằng mắt. */
  async function startAutoPlay(fromIndex: number) {
    autoPlayCancelRef.current = false;
    setAutoPlaying(true);
    const targetLocale = localeForLanguage(language);
    let index = fromIndex;

    while (index >= 0) {
      const acc = accessorsRef.current;
      const words = acc.wordsAt(index);
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
        const id = acc.idAt(index);
        if (id) handleRate(id, 1); // 1 = "Khó" — không await để không làm chậm nhịp tự động next.
      }

      if (index + 1 >= acc.count) break; // hết danh sách, dừng tự động
      index += 1;
      setOpenIndex(index);
    }

    if (!autoPlayCancelRef.current) {
      setAutoPlaying(false);
      setAutoPlayWordIndex(null);
    }
  }

  function toggleAutoPlay() {
    if (autoPlaying) stopAutoPlay();
    else if (openIndex !== null) startAutoPlay(openIndex);
  }

  function open(index: number) {
    stopAutoPlay();
    setOpenIndex(index);
    enterFullscreen();
  }

  function close() {
    stopAutoPlay();
    exitFullscreen();
    setOpenIndex(null);
  }

  function step(delta: number) {
    stopAutoPlay();
    setOpenIndex((cur) => {
      if (cur === null) return cur;
      return Math.min(accessorsRef.current.count - 1, Math.max(0, cur + delta));
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

  return {
    containerRef,
    fullscreenClassName,
    openIndex,
    currentId,
    count: accessors.count,
    currentWordCount,
    zoom,
    setZoom,
    open,
    close,
    step,
    autoPlaying,
    autoPlayWordIndex,
    repeatCount,
    setRepeatCount,
    autoMarkHard,
    setAutoMarkHard,
    toggleAutoPlay,
    bookmarkedIds,
    masteredIds,
    ratingId,
    handleToggleBookmark,
    handleToggleMastered,
    handleRate,
  };
}
