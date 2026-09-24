import enEsData from "../../data/en-es-cognates.json";
import frEsData from "../../data/fr-es-cognates.json";

export interface CognateWord {
  id: string;
  headword: string;
  reading: string;
  example: string;
  exampleVn: string;
}

export interface CognatePair {
  id: string;
  meaningVn: string;
  mnemonicVn: string;
  a: CognateWord;
  b: CognateWord;
}

export interface CognateGroup {
  id: string;
  root: string;
  latinOrigin: string;
  note: string;
  pairs: CognatePair[];
}

interface CognateFileData {
  label: string;
  groups: CognateGroup[];
}

export interface CognatePairConfig {
  /** Khoá dùng trên URL, vd "en-es" trong `/cognates/en-es`. */
  key: string;
  label: string;
  flagA: string;
  flagB: string;
  nameA: string;
  nameB: string;
  /** Locale BCP-47 thô cho phát âm — không dùng `Language` vì tiếng Pháp không nằm trong 5 ngôn ngữ
   * chính của app. */
  localeA: string;
  localeB: string;
}

export interface CognatePairSet extends CognateFileData, CognatePairConfig {}

const PAIR_CONFIGS: Record<string, CognatePairConfig> = {
  "en-es": {
    key: "en-es",
    label: "Anh ↔ Tây Ban Nha",
    flagA: "🇬🇧",
    flagB: "🇪🇸",
    nameA: "tiếng Anh",
    nameB: "tiếng Tây Ban Nha",
    localeA: "en-US",
    localeB: "es-ES",
  },
  "fr-es": {
    key: "fr-es",
    label: "Pháp ↔ Tây Ban Nha",
    flagA: "🇫🇷",
    flagB: "🇪🇸",
    nameA: "tiếng Pháp",
    nameB: "tiếng Tây Ban Nha",
    localeA: "fr-FR",
    localeB: "es-ES",
  },
};

const PAIR_DATA: Record<string, CognateFileData> = {
  "en-es": enEsData as CognateFileData,
  "fr-es": frEsData as CognateFileData,
};

export function getCognatePairConfigs(): CognatePairConfig[] {
  return Object.values(PAIR_CONFIGS);
}

export function getCognatePairSet(key: string): CognatePairSet | null {
  const config = PAIR_CONFIGS[key];
  const data = PAIR_DATA[key];
  if (!config || !data) return null;
  return { ...config, ...data };
}
