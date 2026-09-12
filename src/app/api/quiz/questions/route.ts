import { NextRequest, NextResponse } from "next/server";
import type { Language } from "@/types/vocab";
import type { QuizMode, QuizQuestion } from "@/lib/quiz/types";
import { buildVocabPool } from "@/lib/quiz/pool";
import { generateQuestions } from "@/lib/quiz/generator";
import { loadProgressStore } from "@/lib/progressStore";
import { isDue } from "@/lib/srs";

const LANGS: Language[] = ["zh", "ja", "ko", "en"];
const MODES: QuizMode[] = ["meaning", "reading", "cloze"];

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const langParam = searchParams.get("lang");
  const modeParam = searchParams.get("mode");
  const countParam = Number(searchParams.get("count"));

  const mode = MODES.includes(modeParam as QuizMode) ? (modeParam as QuizMode) : null;
  if (!mode) {
    return NextResponse.json({ error: "mode không hợp lệ (meaning | reading | cloze)." }, { status: 400 });
  }

  const isMixed = langParam === "mixed";
  const lang = LANGS.includes(langParam as Language) ? (langParam as Language) : null;
  if (!isMixed && !lang) {
    return NextResponse.json({ error: "lang không hợp lệ (zh | ja | ko | en | mixed)." }, { status: 400 });
  }

  const count = Number.isFinite(countParam) ? Math.min(30, Math.max(5, Math.round(countParam))) : 12;

  try {
    // Từ "đến hạn ôn" (SRS dueAt <= hiện tại) và chưa mastered — dùng chung 1 danh sách progress cho
    // mọi ngôn ngữ/pool vì id từ vựng là duy nhất toàn cục, mỗi pool tự lọc ra id thuộc về nó.
    const progressStore = await loadProgressStore();
    const priorityIds = new Set(
      Object.entries(progressStore)
        .filter(([, p]) => !p.mastered && isDue(p))
        .map(([id]) => id),
    );

    let questions: QuizQuestion[];

    if (isMixed) {
      const pools = await Promise.all(LANGS.map((l) => buildVocabPool(l)));
      const poolByLang = new Map(LANGS.map((l, i) => [l, pools[i]]));
      questions = [];
      for (let i = 0; i < count; i++) {
        const pickedLang = LANGS[Math.floor(Math.random() * LANGS.length)];
        const pool = poolByLang.get(pickedLang)!;
        const [q] = generateQuestions(pool, mode, 1, pickedLang, priorityIds);
        if (q) questions.push(q);
      }
    } else {
      const pool = await buildVocabPool(lang!);
      questions = generateQuestions(pool, mode, count, lang!, priorityIds);
    }

    return NextResponse.json({ questions });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Không sinh được câu hỏi." },
      { status: 500 },
    );
  }
}
