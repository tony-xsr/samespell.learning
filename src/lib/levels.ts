import type { Language } from "@/types/vocab";

/** Thang trình độ CHUẨN của từng ngôn ngữ — mỗi tiếng dùng kỳ thi riêng, không có thang chung:
 * tiếng Trung dùng HSK, Nhật dùng JLPT, Hàn dùng TOPIK, Anh/Tây Ban Nha dùng CEFR.
 * Dùng chung cho cả prompt gửi AI lẫn giao diện, để nhãn sinh ra và nhãn hiển thị không bao giờ lệch. */
export const LEVEL_SCALE: Record<Language, { name: string; values: string[] }> = {
  zh: { name: "HSK", values: ["HSK1", "HSK2", "HSK3", "HSK4", "HSK5", "HSK6"] },
  ja: { name: "JLPT", values: ["N5", "N4", "N3", "N2", "N1"] },
  ko: { name: "TOPIK", values: ["TOPIK1", "TOPIK2", "TOPIK3", "TOPIK4", "TOPIK5", "TOPIK6"] },
  en: { name: "CEFR", values: ["A1", "A2", "B1", "B2", "C1", "C2"] },
  es: { name: "CEFR", values: ["A1", "A2", "B1", "B2", "C1", "C2"] },
};

/** Thứ tự dễ → khó trong thang của ngôn ngữ đó; -1 nếu nhãn không thuộc thang nào (dữ liệu lạ). */
export function levelRank(language: Language, level?: string): number {
  if (!level) return -1;
  return LEVEL_SCALE[language]?.values.indexOf(level.trim().toUpperCase()) ?? -1;
}

/** Màu theo ĐỘ KHÓ TƯƠNG ĐỐI trong thang của chính ngôn ngữ đó, không theo tên nhãn — nhờ vậy N5 của
 * tiếng Nhật và A1 của tiếng Anh cùng là "dễ nhất" thì cùng màu, dù chữ khác nhau hoàn toàn. */
export function levelClass(language: Language, level?: string): string {
  const i = levelRank(language, level);
  const total = LEVEL_SCALE[language]?.values.length ?? 0;
  if (i < 0 || total === 0) return "bg-surface-3 text-ink-muted";
  const ratio = i / Math.max(1, total - 1);
  if (ratio < 0.34) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
  if (ratio < 0.67) return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
  return "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300";
}

export function levelScaleHint(language: Language): string {
  const s = LEVEL_SCALE[language];
  return `${s.name} (${s.values.join(" / ")})`;
}
