import { NextResponse } from "next/server";
import { loadScenarioProgressStore } from "@/lib/scenarioProgressStore";

export async function GET() {
  const store = await loadScenarioProgressStore();
  return NextResponse.json({ progress: store });
}
