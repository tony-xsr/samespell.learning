export type Language = "zh" | "ko" | "ja";

export interface VocabWord {
  id: string;
  headword: string;
  reading: string;
  meaningVn: string;
  example: string;
  exampleVn: string;
  grammarPoint?: string;
  grammarExplanationVn?: string;
  mnemonicVn?: string;
  children?: VocabWord[];
}

export interface RootEntry {
  id: string;
  character: string;
  meaningVn: string;
  hanViet?: string;
  reading?: string;
  words: VocabWord[];
}

export interface SoundGroup {
  id: string;
  language: Language;
  reading: string;
  note?: string;
  roots: RootEntry[];
}

export interface LanguageData {
  language: Language;
  label: string;
  groups: SoundGroup[];
}

export type SrsRating = 0 | 1 | 2 | 3;

export interface WordProgress {
  interval: number;
  ease: number;
  dueAt: string;
  reviewCount: number;
  lastRating?: SrsRating;
  bookmarked?: boolean;
  mastered?: boolean;
}

export type ProgressStore = Record<string, WordProgress>;
