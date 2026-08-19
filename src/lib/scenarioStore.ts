import "server-only";
import type { Language } from "@/types/vocab";
import type { ScenarioLanguageData, ScenarioEntry } from "@/types/scenario";
import zhScenarios from "../../data/zh-scenarios.json";
import jaScenarios from "../../data/ja-scenarios.json";
import koScenarios from "../../data/ko-scenarios.json";

// Thử nghiệm: dữ liệu "Chuỗi kịch bản" (nối theo bối cảnh/tình huống, khác trục Nối đuôi theo chữ Hán
// dùng chung) tĩnh hoàn toàn, cùng kiểu với chainStore/topicStore.
const STATIC_SCENARIO_DATA: Partial<Record<Language, ScenarioLanguageData>> = {
  zh: zhScenarios as ScenarioLanguageData,
  ja: jaScenarios as ScenarioLanguageData,
  ko: koScenarios as ScenarioLanguageData,
};

export function getScenarioLanguageData(lang: string): ScenarioLanguageData | undefined {
  return STATIC_SCENARIO_DATA[lang as Language];
}

export function getScenarioEntry(lang: string, scenarioId: string): ScenarioEntry | undefined {
  return getScenarioLanguageData(lang)?.scenarios.find((s) => s.id === scenarioId);
}
