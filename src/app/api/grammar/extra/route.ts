import { NextRequest, NextResponse } from "next/server";
import { loadGrammarExtras } from "@/lib/grammarExtras";

export async function GET(req: NextRequest) {
  const lang = req.nextUrl.searchParams.get("lang");
  if (!lang) {
    return NextResponse.json({ error: "Thiếu tham số lang." }, { status: 400 });
  }
  const extras = await loadGrammarExtras(lang);
  return NextResponse.json(extras);
}
