import { NextRequest, NextResponse } from "next/server";
import { lookupFamily } from "@/lib/lookupIndex";

/** GET /api/lookup/family?char=学 — họ chữ: từ Trung + từ Hàn (qua Hanja) chứa chữ này. */
export async function GET(req: NextRequest) {
  const char = Array.from(new URL(req.url).searchParams.get("char") ?? "")[0] ?? "";
  if (!/\p{Script=Han}/u.test(char)) {
    return NextResponse.json({ error: "Cần 1 chữ Hán." }, { status: 400 });
  }
  try {
    return NextResponse.json(await lookupFamily(char));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Không tra được họ chữ.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
