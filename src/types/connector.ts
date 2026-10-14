/** Từ nối / liên từ / trạng từ nối câu (và, hoặc, nhưng, vì vậy, ví dụ…) cho tiếng Trung và tiếng Hàn —
 * xếp theo CHỨC NĂNG tiếng Việt để so song song hai ngôn ngữ. */
export type ConnectorLanguage = "zh" | "ko";

export type ConnectorCategoryId =
  | "add"
  | "choice"
  | "contrast"
  | "cause"
  | "result"
  | "condition"
  | "example"
  | "sequence"
  | "purpose"
  | "summary"
  | "progression"
  | "transition";

export interface ConnectorExample {
  sentence: string;
  translationVn: string;
  /** Đoạn trong `sentence` được che khi luyện điền từ nối. */
  answer: string;
}

export interface ConnectorEntry {
  id: string;
  /** Dạng viết, vd "虽然…但是…", "-(으)니까". */
  form: string;
  /** Pinyin / romanization. */
  reading: string;
  meaningVn: string;
  /** Khung câu, vd "因为 A，所以 B". */
  usage: string;
  register: string;
  nuanceVn: string;
  examples: ConnectorExample[];
  mnemonicVn: string;
  /** Hanja (chỉ tiếng Hàn gốc Hán), "_" = âm tiết thuần Hàn. */
  hanja?: string;
  /** Âm Hán Việt dựng lúc tải (chữ Hán của tiếng Trung / Hanja của tiếng Hàn). */
  hanViet?: string;
}

export interface ConnectorCategory {
  id: ConnectorCategoryId;
  titleVn: string;
  icon: string;
  entries: ConnectorEntry[];
}

export interface ConnectorConfusion {
  id: string;
  titleVn: string;
  entryIds: string[];
  explanationVn: string;
}

export interface ConnectorLanguageData {
  language: ConnectorLanguage;
  categories: ConnectorCategory[];
  confusions: ConnectorConfusion[];
}

/** Id tiến độ SRS của 1 từ nối — tách hẳn khỏi id từ vựng. */
export function connectorProgressId(entryId: string): string {
  return `conn:${entryId}`;
}
