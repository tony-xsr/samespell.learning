import { NextRequest, NextResponse } from "next/server";
import { rateWordServer } from "@/lib/progressStore";
import type { SrsRating } from "@/types/vocab";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const wordId = body?.wordId;
  const rating = body?.rating;

  if (typeof wordId !== "string" || ![0, 1, 2, 3].includes(rating)) {
    return NextResponse.json({ error: "Thiếu wordId hoặc rating không hợp lệ." }, { status: 400 });
  }

  try {
    const updated = await rateWordServer(wordId, rating as SrsRating);
    return NextResponse.json({ progress: updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Không lưu được tiến trình." },
      { status: 500 },
    );
  }
}
