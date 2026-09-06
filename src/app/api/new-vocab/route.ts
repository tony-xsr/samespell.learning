import { NextResponse } from "next/server";
import { loadNewVocabLog } from "@/lib/newVocabLog";

export async function GET() {
  const entries = await loadNewVocabLog();
  return NextResponse.json({ entries });
}
