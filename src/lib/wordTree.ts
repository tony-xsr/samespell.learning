import type { VocabWord } from "@/types/vocab";

/** Recursively flattens a word list, including all nested `children`, into a flat array. */
export function flattenWords(words: VocabWord[]): VocabWord[] {
  return words.flatMap((w) => (w.children && w.children.length > 0 ? [w, ...flattenWords(w.children)] : [w]));
}
