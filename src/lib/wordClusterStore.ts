import "server-only";
import type { Language } from "@/types/vocab";
import type {
  SynonymAntonymLanguageData,
  CharAntonymLanguageData,
} from "@/types/wordCluster";
import zhSynAnt from "../../data/zh-synonym-antonym.json";
import jaSynAnt from "../../data/ja-synonym-antonym.json";
import koSynAnt from "../../data/ko-synonym-antonym.json";
import zhCharAnt from "../../data/zh-char-antonym.json";
import jaCharAnt from "../../data/ja-char-antonym.json";
import koCharAnt from "../../data/ko-char-antonym.json";

// Thử nghiệm: dữ liệu "Đồng nghĩa · trái nghĩa" / "Cặp chữ trái nghĩa" tĩnh hoàn toàn, cùng kiểu với
// chainStore/topicStore — mở rộng thêm cặp hoặc AI-generate sau khi chốt schema thật.
const STATIC_SYN_ANT_DATA: Partial<Record<Language, SynonymAntonymLanguageData>> = {
  zh: zhSynAnt as SynonymAntonymLanguageData,
  ja: jaSynAnt as SynonymAntonymLanguageData,
  ko: koSynAnt as SynonymAntonymLanguageData,
};

const STATIC_CHAR_ANT_DATA: Partial<Record<Language, CharAntonymLanguageData>> = {
  zh: zhCharAnt as CharAntonymLanguageData,
  ja: jaCharAnt as CharAntonymLanguageData,
  ko: koCharAnt as CharAntonymLanguageData,
};

export function getSynonymAntonymData(lang: string): SynonymAntonymLanguageData | undefined {
  return STATIC_SYN_ANT_DATA[lang as Language];
}

export function getCharAntonymData(lang: string): CharAntonymLanguageData | undefined {
  return STATIC_CHAR_ANT_DATA[lang as Language];
}
