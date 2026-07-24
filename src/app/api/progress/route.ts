import { NextResponse } from "next/server";
import { loadProgressStore } from "@/lib/progressStore";

export async function GET() {
  const store = await loadProgressStore();
  return NextResponse.json({ progress: store });
}
