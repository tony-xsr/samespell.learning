"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Hook dùng chung cho nút "Toàn màn hình" ở các trang mindmap/browser.
 *
 * iOS Safari không hỗ trợ Fullscreen API chuẩn (`Element.requestFullscreen()`) cho phần tử DOM
 * thường — chỉ `<video>` mới có fullscreen native. Gọi `requestFullscreen()` trên iOS sẽ bị từ chối
 * (promise reject hoặc `document.fullscreenEnabled` báo `false` từ đầu), khiến nút bấm im lặng không
 * làm gì nếu không có phương án dự phòng.
 *
 * Hook này ưu tiên dùng Fullscreen API thật khi trình duyệt hỗ trợ (giữ nguyên trải nghiệm ẩn thanh
 * trình duyệt trên desktop/Android Chrome), và tự chuyển sang "fullscreen giả" bằng CSS
 * (`position: fixed; inset: 0`) khi API không khả dụng — áp dụng `fullscreenClassName` vào phần tử
 * gắn `containerRef` để có hiệu ứng tương đương trên iOS Safari.
 */
export function useFullscreen<T extends HTMLElement = HTMLDivElement>() {
  const containerRef = useRef<T | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cssFallback, setCssFallback] = useState(false);

  useEffect(() => {
    function onFullscreenChange() {
      // Ở chế độ CSS dự phòng, sự kiện fullscreenchange của trình duyệt (nếu có) không liên quan.
      if (cssFallback) return;
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [cssFallback]);

  const enterFullscreen = useCallback(() => {
    if (document.fullscreenEnabled && containerRef.current) {
      containerRef.current.requestFullscreen().catch(() => {
        // Một số trình duyệt báo fullscreenEnabled=true nhưng vẫn từ chối lúc gọi thật.
        setCssFallback(true);
        setIsFullscreen(true);
      });
    } else {
      // iOS Safari (và một số WebView khác) không hỗ trợ Fullscreen API cho phần tử thường.
      setCssFallback(true);
      setIsFullscreen(true);
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    if (cssFallback) {
      setCssFallback(false);
      setIsFullscreen(false);
    } else if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  }, [cssFallback]);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) exitFullscreen();
    else enterFullscreen();
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  // Dùng h-[100dvh] (dynamic viewport height) thay vì h-screen (100vh) để tránh lỗi kinh điển của
  // Safari mobile: 100vh tính cả phần bị thanh địa chỉ che, khiến nội dung tràn ra ngoài màn hình.
  //
  // Dùng tiền tố "!" (important) cho từng class: container ở các nơi gọi hook này luôn có sẵn class
  // "relative" (để định vị các phần tử con position:absolute bên trong) — nếu không ép !important,
  // "relative" và "fixed" cùng specificity nên class nào được Tailwind sinh CSS sau sẽ thắng, thứ tự đó
  // phụ thuộc nội bộ vào Tailwind chứ không phải thứ tự trong chuỗi className, nên có thể ngẫu nhiên
  // đè mất "fixed" — đã kiểm chứng lỗi này thực tế xảy ra (position tính ra "relative" dù có "fixed").
  const fullscreenClassName = cssFallback ? "!fixed !inset-0 !z-40 !h-[100dvh]" : "";

  return {
    containerRef,
    isFullscreen,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
    fullscreenClassName,
  };
}
