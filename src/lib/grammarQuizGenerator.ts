import type { Language } from "@/types/vocab";
import type { GrammarLanguageData } from "@/types/grammar";
import type { GrammarQuizEntry, GrammarQuizMode, GrammarQuizOption, GrammarQuizQuestion } from "@/lib/grammarQuizTypes";

/** Làm phẳng toàn bộ điểm ngữ pháp của 1 ngôn ngữ thành pool để sinh câu hỏi — thuần hàm biến đổi dữ
 * liệu tĩnh (không async, không cần cache như `lib/quiz/pool.ts` vì không phải merge nhiều nguồn).
 * `categoryId`: chỉ lấy điểm thuộc 1 nhóm chức năng cụ thể — cùng lý do với `buildGrammarCards` bên
 * ôn thẻ lật (mỗi nhóm có phần luyện tập riêng thay vì trộn hết 351/343 điểm vào 1 phiên). */
export function buildGrammarQuizPool(data: GrammarLanguageData, categoryId?: string): GrammarQuizEntry[] {
  const entries: GrammarQuizEntry[] = [];
  for (const category of data.categories) {
    if (categoryId && category.id !== categoryId) continue;
    for (const point of category.points) {
      const ex = point.examples[0];
      if (!ex) continue; // mọi điểm hiện đều có ví dụ, nhưng phòng hờ dữ liệu tương lai thiếu
      entries.push({
        id: point.id,
        pattern: point.pattern,
        formationRule: point.formationRule,
        meaningVn: point.meaningVn,
        nuanceVn: point.nuanceVn,
        categoryId: category.id,
        confusionGroupId: point.confusionGroupId,
        example: { sentence: ex.sentence, translationVn: ex.translationVn, note: ex.note },
        mnemonicVn: point.mnemonicVn,
        commonMistakeVn: point.commonMistakeVn,
      });
    }
  }
  return entries;
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function norm(label: string): string {
  return label.trim().toLowerCase();
}

/** Chọn `n` điểm nhiễu cho `target`, ưu tiên cùng cụm dễ nhầm (`confusionGroupId`, khó nhất — 2 cấu
 * trúc GIỐNG NHAU về hình thức/ngữ cảnh) → cùng category → ngẫu nhiên toàn pool. Giống hệt tinh thần
 * `pickDistractors` bên `lib/quiz/generator.ts`. */
function pickDistractors(
  target: GrammarQuizEntry,
  pool: GrammarQuizEntry[],
  labelOf: (entry: GrammarQuizEntry) => string,
  n: number,
): GrammarQuizEntry[] {
  const usedLabels = new Set([norm(labelOf(target))]);
  const chosen: GrammarQuizEntry[] = [];

  const tiers = [
    target.confusionGroupId ? pool.filter((e) => e.confusionGroupId === target.confusionGroupId) : [],
    pool.filter((e) => e.categoryId === target.categoryId),
    pool,
  ];

  for (const tier of tiers) {
    if (chosen.length >= n) break;
    for (const entry of shuffle(tier)) {
      if (chosen.length >= n) break;
      if (entry.id === target.id) continue;
      const label = labelOf(entry);
      const key = norm(label);
      if (!label || usedLabels.has(key)) continue;
      usedLabels.add(key);
      chosen.push(entry);
    }
  }
  return chosen;
}

function buildOptions(
  target: GrammarQuizEntry,
  distractors: GrammarQuizEntry[],
  labelOf: (entry: GrammarQuizEntry) => string,
): GrammarQuizOption[] {
  const options: GrammarQuizOption[] = [
    { id: target.id, label: labelOf(target), correct: true },
    ...distractors.map((d) => ({ id: d.id, label: labelOf(d), correct: false })),
  ];
  return shuffle(options);
}

/** Các trường mô tả đầy đủ đáp án đúng — giống nhau ở cả 2 mode, tách riêng để khỏi lặp lại. */
function answerDetails(target: GrammarQuizEntry) {
  return {
    answerPointId: target.id,
    answerPattern: target.pattern,
    answerFormationRule: target.formationRule,
    answerMeaningVn: target.meaningVn,
    answerNuanceVn: target.nuanceVn,
    answerExample: target.example.sentence,
    answerExampleVn: target.example.translationVn,
    answerExampleNote: target.example.note,
    answerMnemonicVn: target.mnemonicVn,
    answerCommonMistakeVn: target.commonMistakeVn,
  };
}

function buildQuestion(
  target: GrammarQuizEntry,
  pool: GrammarQuizEntry[],
  mode: GrammarQuizMode,
  language: Language,
  index: number,
): GrammarQuizQuestion | null {
  if (mode === "meaning") {
    const labelOf = (e: GrammarQuizEntry) => e.meaningVn;
    const distractors = pickDistractors(target, pool, labelOf, 3);
    if (distractors.length < 3) return null;
    return {
      id: `${target.id}-meaning-${index}-${Math.random().toString(36).slice(2, 8)}`,
      language,
      mode,
      promptLabel: target.pattern,
      promptSubLabel: target.formationRule || undefined,
      options: buildOptions(target, distractors, labelOf),
      ...answerDetails(target),
    };
  }

  // mode === "usage": ngược lại với "meaning" — đề bài LÀ câu ví dụ + nghĩa (ngữ cảnh cần để chọn),
  // đáp án là cấu trúc (pattern) đúng đang được minh hoạ.
  const labelOf = (e: GrammarQuizEntry) => e.pattern;
  const distractors = pickDistractors(target, pool, labelOf, 3);
  if (distractors.length < 3) return null;
  return {
    id: `${target.id}-usage-${index}-${Math.random().toString(36).slice(2, 8)}`,
    language,
    mode,
    promptLabel: target.example.sentence,
    promptTranslationVn: target.example.translationVn,
    options: buildOptions(target, distractors, labelOf),
    ...answerDetails(target),
  };
}

/** Sinh `count` câu hỏi ngẫu nhiên từ `pool` — không seed cố định, mỗi lần vào lại ra bộ câu khác
 * nhau, giống hệt `generateQuestions` bên từ vựng. */
export function generateGrammarQuestions(
  pool: GrammarQuizEntry[],
  mode: GrammarQuizMode,
  count: number,
  language: Language,
): GrammarQuizQuestion[] {
  if (pool.length < 4) return [];

  const questions: GrammarQuizQuestion[] = [];
  const candidates = shuffle(pool);
  let cursor = 0;
  let attempts = 0;
  const maxAttempts = pool.length * 2 + count * 4;

  while (questions.length < count && attempts < maxAttempts) {
    const target = candidates[cursor % candidates.length];
    cursor++;
    attempts++;
    const question = buildQuestion(target, pool, mode, language, questions.length);
    if (question) questions.push(question);
  }

  return questions;
}
