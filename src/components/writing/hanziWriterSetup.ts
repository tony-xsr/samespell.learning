"use client";

import type HanziWriter from "hanzi-writer";

/** Tải hanzi-writer khi cần (chỉ chạy trong trình duyệt). Dữ liệu nét của từng chữ (bộ Make Me a Hanzi,
 * ~9.000 chữ giản thể + phồn thể) do thư viện tự tải từ CDN jsdelivr theo từng chữ, trình duyệt cache lại. */
export async function loadHanziWriter(): Promise<typeof HanziWriter> {
  return (await import("hanzi-writer")).default;
}

/** Một chữ Hán (không tính dấu câu, chữ Latinh, số) — chỉ những ký tự này mới có dữ liệu nét. */
export function isHanChar(c: string): boolean {
  return /\p{Script=Han}/u.test(c);
}

/** Lấy màu chữ thật của theme (sáng/tối) từ CSS rồi đổi sang hex cho hanzi-writer. Lưu ý thư viện chỉ nhận
 * #rgb / #rrggbb / rgb() / rgba() — hex 8 ký tự (#rrggbbaa) ném lỗi "Invalid color" và hỏng cả ô viết,
 * muốn màu mờ thì dùng rgba(). */
export function cssColorToHex(color: string, fallback = "#1f2937"): string {
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return color.startsWith("#") ? color : fallback;
  return "#" + m.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, "0")).join("");
}

export type WriterInstance = HanziWriter;

/** Ghi 1 lần viết xong 1 chữ (tô / nhớ) vào tiến độ luyện viết — lỗi mạng thì bỏ qua, không chặn UI. */
export function recordWritingAttempt(char: string, mistakes: number, mode: "trace" | "recall"): void {
  fetch("/api/writing/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ char, mistakes, mode }),
  })
    .then(() => window.dispatchEvent(new Event("writing-progress-updated")))
    .catch(() => {
      /* không lưu được thì thôi — lần sau viết lại vẫn ghi */
    });
}
