"use client";

import type { Language } from "@/types/vocab";

const LOCALE: Record<Language, string> = {
  zh: "zh-CN",
  ko: "ko-KR",
  ja: "ja-JP",
  en: "en-US",
};

/** Locale BCP-47 cho giọng đọc tiếng Việt — dùng ở chế độ tự động đọc để phát nghĩa tiếng Việt to lên. */
export const VI_LOCALE = "vi-VN";

/** Lấy locale ứng với 1 trong 4 ngôn ngữ mục tiêu của app (không phải tiếng Việt). */
export function localeForLanguage(language: Language): string {
  return LOCALE[language];
}

export function isTtsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Trong số các giọng khớp locale, một số máy/trình duyệt có NHIỀU giọng cùng cài cho cùng 1 ngôn ngữ —
 * ví dụ Windows thường có sẵn giọng SAPI cũ (vd "Microsoft Huihui" cho zh-CN) đọc khá máy móc, trong khi
 * Chrome có thể lộ thêm giọng mạng chất lượng cao hơn nhiều (tên chứa "Google", "Online", "Natural"...)
 * nếu máy đang có mạng. `voices.find()` đơn thuần theo `lang` sẽ lấy giọng ĐẦU TIÊN theo thứ tự do hệ
 * điều hành/trình duyệt trả về (không theo chất lượng) — nên chủ động ưu tiên các giọng có tên khớp mẫu
 * "nghe tự nhiên hơn" đã biết trước khi rơi về giọng đầu tiên tìm được. */
const PREFERRED_VOICE_NAME_PATTERN = /google|natural|online|neural|premium|enhanced/i;

function pickBestVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | undefined {
  const exact = voices.filter((v) => v.lang === lang);
  const prefixed = voices.filter((v) => v.lang.toLowerCase().startsWith(lang.split("-")[0].toLowerCase()));
  const candidates = exact.length > 0 ? exact : prefixed;
  if (candidates.length === 0) return undefined;
  return candidates.find((v) => PREFERRED_VOICE_NAME_PATTERN.test(v.name)) ?? candidates[0];
}

function waitForVoices(): Promise<SpeechSynthesisVoice[]> {
  const existing = window.speechSynthesis.getVoices();
  if (existing.length > 0) return Promise.resolve(existing);
  // Chrome nạp danh sách giọng đọc bất đồng bộ — nếu gọi speak() ngay khi trang vừa tải,
  // getVoices() có thể trả về rỗng dù máy có cài giọng. Đợi 1 lần rồi lấy lại.
  return new Promise((resolve) => {
    const handler = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", handler);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener("voiceschanged", handler);
    setTimeout(() => {
      window.speechSynthesis.removeEventListener("voiceschanged", handler);
      resolve(window.speechSynthesis.getVoices());
    }, 400);
  });
}

export interface SpeakResult {
  ok: boolean;
  reason?: "unsupported" | "no-voice";
}

export async function speak(text: string, language: Language, rate = 0.85): Promise<SpeakResult> {
  if (!isTtsSupported() || !text.trim()) return { ok: false, reason: "unsupported" };
  const lang = LOCALE[language];
  const voices = await waitForVoices();
  if (voices.length === 0) return { ok: false, reason: "no-voice" };

  const voice = pickBestVoice(voices, lang);
  if (!voice) return { ok: false, reason: "no-voice" };

  // Một số trình duyệt/thiết bị (đặc biệt WebView Android cũ) có thể throw ngay ở cancel()/speak()
  // khi engine đọc to gặp trục trặc — bọc try/catch để lỗi này không rơi thành unhandled rejection
  // và không kéo theo bất kỳ tương tác UI nào khác (như lật thẻ) bị ảnh hưởng.
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = rate;
    window.speechSynthesis.speak(utterance);
    // Bug phổ biến ở Chrome/Windows: sau cancel(), engine đôi khi treo ở trạng thái "paused"
    // khiến speak() kế tiếp không phát ra tiếng — resume() ngay sau để đảm bảo utterance chạy.
    window.speechSynthesis.resume();
  } catch {
    return { ok: false, reason: "no-voice" };
  }
  return { ok: true };
}

/** Dùng cho chế độ tự động đọc (vòng lặp): đọc `text` bằng giọng của `locale` (locale thô, không phải
 * `Language` — cho phép đọc cả tiếng Việt "vi-VN" chứ không chỉ 4 ngôn ngữ mục tiêu của app), và CHỜ
 * đọc xong (hoặc hết `timeoutMs`) trước khi resolve — để các bước trong vòng lặp không chồng tiếng lên
 * nhau. `onend`/`onerror` của `SpeechSynthesisUtterance` không phải lúc nào cũng bắn ra đáng tin cậy
 * trên mọi trình duyệt (xem ghi chú ở `speak()` về bug Chrome/Windows), nên có `timeoutMs` làm lưới an
 * toàn: nếu sự kiện không bắn trong thời gian đó, coi như đã xong và tiếp tục vòng lặp thay vì treo mãi. */
export async function speakAndWait(
  text: string,
  locale: string,
  rate = 0.85,
  timeoutMs = 4000,
): Promise<SpeakResult> {
  if (!isTtsSupported() || !text.trim()) return { ok: false, reason: "unsupported" };
  const voices = await waitForVoices();
  if (voices.length === 0) return { ok: false, reason: "no-voice" };

  const voice = pickBestVoice(voices, locale);
  if (!voice) return { ok: false, reason: "no-voice" };

  return new Promise((resolve) => {
    let settled = false;
    let safetyTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      if (safetyTimer) clearTimeout(safetyTimer);
      resolve({ ok });
    };
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = rate;
      utterance.onend = () => finish(true);
      utterance.onerror = () => finish(false);
      window.speechSynthesis.speak(utterance);
      window.speechSynthesis.resume();
      safetyTimer = setTimeout(() => finish(true), timeoutMs);
    } catch {
      finish(false);
    }
  });
}

export function ttsFailureMessage(reason: SpeakResult["reason"]): string {
  if (reason === "unsupported") return "Trình duyệt này không hỗ trợ đọc to (Web Speech API).";
  return "Máy/trình duyệt của bạn chưa có giọng đọc cho ngôn ngữ này — vào Cài đặt Windows → Giờ & Ngôn ngữ → Giọng nói để cài thêm.";
}
