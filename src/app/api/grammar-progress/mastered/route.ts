import { NextRequest, NextResponse } from "next/server";
import { toggleGrammarMasteredServer } from "@/lib/grammarProgressStore";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const cardId = body?.cardId;
  if (typeof cardId !== "string") {
    return NextResponse.json({ error: "Thiếu cardId." }, { status: 400 });
  }

  try {
    const updated = await toggleGrammarMasteredServer(cardId);
    return NextResponse.json({ progress: updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Không lưu được trạng thái đã thuộc." },
      { status: 500 },
    );
  }
}
