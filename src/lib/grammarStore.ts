import "server-only";
import type { Language } from "@/types/vocab";
import type { GrammarLanguageData, GrammarPoint } from "@/types/grammar";
import koGrammar from "../../data/ko-grammar.json";
import jaGrammar from "../../data/ja-grammar.json";
import zhGrammar from "../../data/zh-grammar.json";

/** Dữ liệu ngữ pháp soạn tay (không dùng AI sinh, không merge Redis — xem Features.md mục 6-7 lý do).
 * Chỉ khai báo cho ngôn ngữ nào đã có file data tương ứng. */
const STATIC_GRAMMAR: Partial<Record<Language, GrammarLanguageData>> = {
  ko: koGrammar as GrammarLanguageData,
  ja: jaGrammar as GrammarLanguageData,
  // Tiếng Trung không chia động từ theo thì nên khung category khác hẳn Hàn/Nhật: trọng tâm là trợ từ
  // thể (了/着/过), bộ ba 的/地/得, giới từ 把/被, lượng từ, bổ ngữ và phó từ sắc thái. Xem Features.md 21.3.
  zh: zhGrammar as GrammarLanguageData,
};

export function getGrammarLanguages(): GrammarLanguageData[] {
  return Object.values(STATIC_GRAMMAR).filter((d): d is GrammarLanguageData => !!d);
}

export function getGrammarData(lang: string): GrammarLanguageData | undefined {
  return STATIC_GRAMMAR[lang as Language];
}

export function getAllGrammarPoints(data: GrammarLanguageData): GrammarPoint[] {
  return data.categories.flatMap((c) => c.points);
}

export function getGrammarPoint(data: GrammarLanguageData, pointId: string): GrammarPoint | undefined {
  return getAllGrammarPoints(data).find((p) => p.id === pointId);
}

export function countGrammarPoints(data: GrammarLanguageData): number {
  return getAllGrammarPoints(data).length;
}

/** Trục B (mindmap ngữ pháp) — chỉ những điểm đã gắn `timeAxis` mới xuất hiện trên lưới thời gian
 * (không phải mọi điểm ngữ pháp đều có vị trí trên trục thời gian, vd trợ từ/kính ngữ thì không). */
export function getTimeAxisPoints(data: GrammarLanguageData): GrammarPoint[] {
  return getAllGrammarPoints(data).filter((p) => p.timeAxis);
}
