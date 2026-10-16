import { NextRequest, NextResponse } from "next/server";
import { loadWritingProgress, recordWritingAttempt, summarizeWriting } from "@/lib/writingProgressStore";

export async function GET() {
  try {
    const progress = await loadWritingProgress();
    return NextResponse.json({ summary: summarizeWriting(progress), progress });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Không tải được tiến độ luyện viết.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Ghi 1 lần viết xong 1 chữ: `{ char, mistakes, mode: "trace" | "recall" }`. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const char = typeof body?.char === "string" ? body.char : "";
  const mistakes = Number(body?.mistakes);
  const mode = body?.mode === "recall" ? "recall" : body?.mode === "trace" ? "trace" : null;
  if (Array.from(char).length !== 1 || !/\p{Script=Han}/u.test(char) || !Number.isFinite(mistakes) || mistakes < 0 || !mode) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
  try {
    const stat = await recordWritingAttempt(char, Math.round(mistakes), mode);
    return NextResponse.json({ stat });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Không lưu được tiến độ luyện viết.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
