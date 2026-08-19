import type { Language } from "@/types/vocab";

/** "Chuỗi kịch bản" — trục tổ chức từ vựng THEO BỐI CẢNH/TÌNH HUỐNG (vd "chuyển nhà mới", "học lái xe
 * thi trượt rồi đậu"), khác với "Nối đuôi" (`WordChain`) vốn nối theo CHỮ HÁN DÙNG CHUNG. Mỗi node là 1
 * bước trong mạch tình huống, KHÔNG có quan hệ nối chữ như domino — chỉ nối theo mạch nghĩa/tường thuật. */
export type ScenarioPos = "noun" | "verb-phrase" | "adjective" | "adverb" | "emotion" | "idiom" | "phrase";

export interface ScenarioNode {
  headword: string;
  reading: string;
  hanViet: string | null;
  meaningVn: string;
  pos: ScenarioPos;
}

export interface ScenarioChain {
  id: string;
  kind: "scenario-chain";
  titleVn: string;
  nodes: ScenarioNode[];
  exampleVn: string;
  example: string;
  note: string;
}

/** Dạng chùm (không tuyến tính) — nhiều từ cùng xoay quanh 1 chủ đề/cảm xúc, không có thứ tự trước sau. */
export interface ScenarioCluster {
  id: string;
  kind: "scenario-cluster";
  themeVn: string;
  words: ScenarioNode[];
  note: string;
}

export type ScenarioEntry = ScenarioChain | ScenarioCluster;

export interface ScenarioLanguageData {
  language: Language;
  label: string;
  scenarios: ScenarioEntry[];
  todo?: string[];
}
