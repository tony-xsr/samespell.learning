import { NextRequest, NextResponse } from "next/server";
import { toggleScenarioLearnedServer } from "@/lib/scenarioProgressStore";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const scenarioId = body?.scenarioId;
  if (typeof scenarioId !== "string") {
    return NextResponse.json({ error: "Thiếu scenarioId." }, { status: 400 });
  }

  try {
    const updated = await toggleScenarioLearnedServer(scenarioId);
    return NextResponse.json({ progress: updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Không lưu được trạng thái đã thuộc." },
      { status: 500 },
    );
  }
}
