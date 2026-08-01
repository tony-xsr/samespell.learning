import { NextResponse } from "next/server";
import { loadGrammarProgressStore } from "@/lib/grammarProgressStore";

export async function GET() {
  const store = await loadGrammarProgressStore();
  return NextResponse.json({ progress: store });
}
