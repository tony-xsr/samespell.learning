import { NextRequest, NextResponse } from "next/server";
import { toggleBookmarkServer } from "@/lib/progressStore";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const wordId = body?.wordId;
  if (typeof wordId !== "string") {
    return NextResponse.json({ error: "Thiếu wordId." }, { status: 400 });
  }

  try {
    const updated = await toggleBookmarkServer(wordId);
    return NextResponse.json({ progress: updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Không lưu được yêu thích." },
      { status: 500 },
    );
  }
}
