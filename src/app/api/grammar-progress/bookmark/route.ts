import { NextRequest, NextResponse } from "next/server";
import { toggleGrammarBookmarkServer } from "@/lib/grammarProgressStore";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const cardId = body?.cardId;
  if (typeof cardId !== "string") {
    return NextResponse.json({ error: "Thiếu cardId." }, { status: 400 });
  }

  try {
    const updated = await toggleGrammarBookmarkServer(cardId);
    return NextResponse.json({ progress: updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Không lưu được yêu thích." },
      { status: 500 },
    );
  }
}
