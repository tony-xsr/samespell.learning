import type { Language } from "@/types/vocab";

export interface ClusterWord {
  headword: string;
  /** Chỉ tiếng Hàn: chữ Hanja gốc — Hangul không lộ chữ Hán chung trên mặt chữ. */
  hanja?: string;
  reading: string;
  hanViet: string;
  meaningVn: string;
}

/** Cơ chế 2 (Features.md §10.3) — 1 cụm từ gần nghĩa đối lập trực tiếp với 1 cụm từ trái nghĩa,
 * không cần chung chữ (khác `WordChain`/`CharAntonymPair` vốn liên kết qua chữ Hán dùng chung). */
export interface SynonymAntonymPair {
  id: string;
  language: Language;
  kind: "antonym-pair";
  synonymCluster: { sharedChar: string | null; words: ClusterWord[] };
  antonymCluster: { sharedChar: string | null; words: ClusterWord[] };
  note: string;
}

/** Cơ chế 2b (Features.md §10.3, biến thể) — 1 cụm từ gần nghĩa/khác sắc thái, KHÔNG kèm cụm trái nghĩa
 * đối lập (khác `SynonymAntonymPair` luôn bắt buộc có `antonymCluster`). Dùng cho các nhóm từ đồng nghĩa
 * lớn (3-5 từ) mà bản thân cụm không có 1 cụm trái nghĩa tự nhiên tương ứng, vd 现象/趋势/形势/局势/动态. */
export interface SynonymCluster {
  id: string;
  language: Language;
  kind: "synonym-cluster";
  sharedChar: string | null;
  words: ClusterWord[];
  note: string;
}

export interface SynonymAntonymLanguageData {
  language: Language;
  label: string;
  pairs: SynonymAntonymPair[];
  synonymClusters?: SynonymCluster[];
  todo?: string[];
}

/** Đề xuất thêm (không có trong Features.md §10.5 draft) — 2 chữ gốc trái nghĩa nhau, mỗi chữ toả ra
 * 1 "gia đình" từ ghép riêng. Khác `SynonymAntonymPair` vì đối lập NGAY TỪ CHỮ GỐC, không phải ở cả cụm từ. */
export interface AntonymRoot {
  character: string;
  reading: string;
  hanViet: string;
  meaningVn: string;
  words: ClusterWord[];
}

export interface CharAntonymPair {
  id: string;
  language: Language;
  kind: "char-antonym";
  left: AntonymRoot;
  right: AntonymRoot;
  note: string;
}

export interface CharAntonymLanguageData {
  language: Language;
  label: string;
  pairs: CharAntonymPair[];
  todo?: string[];
}
