import { NextRequest, NextResponse } from "next/server";
import type { Language } from "@/types/vocab";
import type { GrammarQuizMode, GrammarQuizQuestion } from "@/lib/grammarQuizTypes";
import { getGrammarData } from "@/lib/grammarStore";
import { buildGrammarQuizPool, generateGrammarQuestions } from "@/lib/grammarQuizGenerator";

// Dữ liệu ngữ pháp soạn tay hiện chỉ có ko/ja (xem `lib/grammarStore.ts`) — không có "mixed" như quiz
// từ vựng vì trộn ngữ pháp 2 ngôn ngữ khác hệ thống vào 1 phiên luyện không thực sự hữu ích.
const LANGS: Language[] = ["ko", "ja"];
const MODES: GrammarQuizMode[] = ["meaning", "usage"];

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const langParam = searchParams.get("lang");
  const modeParam = searchParams.get("mode");
  const countParam = Number(searchParams.get("count"));

  const mode = MODES.includes(modeParam as GrammarQuizMode) ? (modeParam as GrammarQuizMode) : null;
  if (!mode) {
    return NextResponse.json({ error: "mode không hợp lệ (meaning | usage)." }, { status: 400 });
  }

  const lang = LANGS.includes(langParam as Language) ? (langParam as Language) : null;
  if (!lang) {
    return NextResponse.json({ error: "lang không hợp lệ (ko | ja)." }, { status: 400 });
  }

  const count = Number.isFinite(countParam) ? Math.min(30, Math.max(5, Math.round(countParam))) : 12;

  const data = getGrammarData(lang);
  if (!data) {
    return NextResponse.json({ error: "Chưa có dữ liệu ngữ pháp cho ngôn ngữ này." }, { status: 404 });
  }

  try {
    const pool = buildGrammarQuizPool(data);
    const questions: GrammarQuizQuestion[] = generateGrammarQuestions(pool, mode, count, lang);
    return NextResponse.json({ questions });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Không sinh được câu hỏi." },
      { status: 500 },
    );
  }
}
