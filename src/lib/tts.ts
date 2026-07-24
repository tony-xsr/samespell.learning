"use client";

import type { Language } from "@/types/vocab";

const LOCALE: Record<Language, string> = {
  zh: "zh-CN",
  ko: "ko-KR",
  ja: "ja-JP",
};

export function isTtsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
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

  const voice =
    voices.find((v) => v.lang === lang) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(lang.split("-")[0].toLowerCase()));
  if (!voice) return { ok: false, reason: "no-voice" };

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = rate;
  window.speechSynthesis.speak(utterance);
  // Bug phổ biến ở Chrome/Windows: sau cancel(), engine đôi khi treo ở trạng thái "paused"
  // khiến speak() kế tiếp không phát ra tiếng — resume() ngay sau để đảm bảo utterance chạy.
  window.speechSynthesis.resume();
  return { ok: true };
}

export function ttsFailureMessage(reason: SpeakResult["reason"]): string {
  if (reason === "unsupported") return "Trình duyệt này không hỗ trợ đọc to (Web Speech API).";
  return "Máy/trình duyệt của bạn chưa có giọng đọc cho ngôn ngữ này — vào Cài đặt Windows → Giờ & Ngôn ngữ → Giọng nói để cài thêm.";
}
