import type { Language } from "@/types/vocab";
import type { QuizMode, QuizOption, QuizQuestion, QuizWordEntry } from "@/lib/quiz/types";

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

/** Chọn `n` từ nhiễu cho `target`, ưu tiên cùng `sourceKey` (nhiễu "gần giống" khó nhất) → cùng
 * `axisKind` → ngẫu nhiên toàn pool. Loại các từ có nhãn (theo `labelOf`) trùng đáp án đúng hoặc
 * trùng nhau để tránh 2 lựa chọn nhìn giống hệt nhau trên màn hình. */
function pickDistractors(
  target: QuizWordEntry,
  pool: QuizWordEntry[],
  labelOf: (entry: QuizWordEntry) => string,
  n: number,
): QuizWordEntry[] {
  const usedLabels = new Set([norm(labelOf(target))]);
  const chosen: QuizWordEntry[] = [];

  const tiers = [
    pool.filter((e) => e.sourceKey === target.sourceKey),
    pool.filter((e) => e.axisKind === target.axisKind),
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

function buildClozeSentence(example: string, headword: string): string | null {
  const index = example.indexOf(headword);
  if (index === -1) return null;
  return example.slice(0, index) + "____" + example.slice(index + headword.length);
}

function buildOptions(
  target: QuizWordEntry,
  distractors: QuizWordEntry[],
  labelOf: (entry: QuizWordEntry) => string,
): QuizOption[] {
  const options: QuizOption[] = [
    { id: target.id, label: labelOf(target), correct: true },
    ...distractors.map((d) => ({ id: d.id, label: labelOf(d), correct: false })),
  ];
  return shuffle(options);
}

function buildQuestion(
  target: QuizWordEntry,
  pool: QuizWordEntry[],
  mode: QuizMode,
  language: Language,
  index: number,
): QuizQuestion | null {
  if (mode === "meaning") {
    const labelOf = (e: QuizWordEntry) => e.meaningVn;
    const distractors = pickDistractors(target, pool, labelOf, 3);
    if (distractors.length < 3) return null;
    return {
      id: `${target.id}-meaning-${index}-${Math.random().toString(36).slice(2, 8)}`,
      language,
      mode,
      promptLabel: target.headword,
      promptSubLabel: target.reading || undefined,
      options: buildOptions(target, distractors, labelOf),
      answerWordId: target.id,
    };
  }

  if (mode === "reading") {
    if (!target.reading) return null;
    const labelOf = (e: QuizWordEntry) => e.reading;
    const distractors = pickDistractors(target, pool, labelOf, 3);
    if (distractors.length < 3) return null;
    return {
      id: `${target.id}-reading-${index}-${Math.random().toString(36).slice(2, 8)}`,
      language,
      mode,
      promptLabel: target.headword,
      options: buildOptions(target, distractors, labelOf),
      answerWordId: target.id,
    };
  }

  // mode === "cloze"
  const cloze = buildClozeSentence(target.example, target.headword);
  if (!cloze) return null;
  const labelOf = (e: QuizWordEntry) => e.headword;
  const distractors = pickDistractors(target, pool, labelOf, 3);
  if (distractors.length < 3) return null;
  return {
    id: `${target.id}-cloze-${index}-${Math.random().toString(36).slice(2, 8)}`,
    language,
    mode,
    promptLabel: cloze,
    options: buildOptions(target, distractors, labelOf),
    answerWordId: target.id,
  };
}

/** Sinh `count` câu hỏi ngẫu nhiên từ `pool`. Mỗi lần gọi ra kết quả khác nhau (không seed cố định)
 * — với pool hàng nghìn từ × 3 dạng câu × xáo trộn nhiễu, số tổ hợp câu hỏi có thể sinh ra là hàng
 * chục nghìn trở lên mà không cần soạn tay bất kỳ nội dung nào. */
export function generateQuestions(
  pool: QuizWordEntry[],
  mode: QuizMode,
  count: number,
  language: Language,
): QuizQuestion[] {
  if (pool.length < 4) return [];

  const questions: QuizQuestion[] = [];
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
