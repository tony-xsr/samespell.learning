import { NextRequest, NextResponse } from "next/server";
import { rateGrammarCardServer } from "@/lib/grammarProgressStore";
import type { SrsRating } from "@/types/vocab";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const cardId = body?.cardId;
  const rating = body?.rating;

  if (typeof cardId !== "string" || ![0, 1, 2, 3].includes(rating)) {
    return NextResponse.json({ error: "Thiếu cardId hoặc rating không hợp lệ." }, { status: 400 });
  }

  try {
    const updated = await rateGrammarCardServer(cardId, rating as SrsRating);
    return NextResponse.json({ progress: updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Không lưu được tiến trình." },
      { status: 500 },
    );
  }
}
