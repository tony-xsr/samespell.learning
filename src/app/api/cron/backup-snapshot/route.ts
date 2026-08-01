import { NextResponse } from "next/server";
import { saveSnapshot } from "@/lib/backupSnapshots";

export async function GET() {
  try {
    const { date } = await saveSnapshot();
    return NextResponse.json({ ok: true, date });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Không lưu được snapshot.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
