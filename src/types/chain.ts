import type { Language } from "@/types/vocab";

/** 1 mắt xích trong chuỗi domino — 1 từ ghép, nối với từ trước/sau qua 1 chữ Hán dùng chung.
 * `sharedCharPrev`/`sharedCharNext` là `null` ở 2 đầu chuỗi. */
export interface ChainNode {
  headword: string;
  /** Chỉ tiếng Hàn: chữ Hanja gốc — Hangul không lộ chữ Hán chung trên mặt chữ như Trung/Nhật. */
  hanja?: string;
  reading: string;
  hanViet: string;
  meaningVn: string;
  sharedCharPrev: string | null;
  sharedCharNext: string | null;
}

export interface WordChain {
  id: string;
  language: Language;
  kind: "chain";
  nodes: ChainNode[];
  note: string;
}

/** 1 từ thành viên trong 1 chùm (cluster) — khác `ChainNode` vì không cần `sharedCharPrev`/`sharedCharNext`
 * (chùm không có thứ tự tuyến tính, mọi từ đều chứa chung 1 `centerChar` của chùm). */
export interface ClusterMemberWord {
  headword: string;
  /** Chỉ tiếng Hàn: chữ Hanja gốc — Hangul không lộ chữ Hán chung trên mặt chữ như Trung/Nhật. */
  hanja?: string;
  reading: string;
  hanViet: string;
  meaningVn: string;
}

/** Cơ chế 1b (Features.md §10.2) — chùm từ toả quanh 1 chữ Hán dùng chung ("hoa thị"), không có thứ tự
 * đầu-đuôi như `WordChain`. Kèm mẹo nhớ theo cấu tạo/nghĩa gốc của `centerChar` trong `note`. */
export interface WordCluster {
  id: string;
  language: Language;
  kind: "cluster";
  centerChar: string;
  centerReading: string;
  centerHanViet: string;
  centerMeaningVn: string;
  words: ClusterMemberWord[];
  note: string;
}

export interface ChainLanguageData {
  language: Language;
  label: string;
  chains: WordChain[];
  clusters?: WordCluster[];
  todo?: string[];
}
