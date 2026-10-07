import { NextRequest, NextResponse } from "next/server";
import { saveRestDaysServer } from "@/lib/personalCollectionsStore";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restDays = body?.restDays;
  if (!Array.isArray(restDays) || restDays.some((d) => typeof d !== "number")) {
    return NextResponse.json({ error: "restDays phải là mảng số 0–6." }, { status: 400 });
  }
  try {
    const collections = await saveRestDaysServer(restDays);
    return NextResponse.json({ collections });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Không lưu được ngày nghỉ." },
      { status: 500 },
    );
  }
}
