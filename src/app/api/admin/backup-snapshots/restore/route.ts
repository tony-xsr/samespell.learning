import { NextRequest, NextResponse } from "next/server";
import { restoreSnapshot } from "@/lib/backupSnapshots";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const date = typeof body?.date === "string" ? body.date : null;
  if (!date) {
    return NextResponse.json({ error: "Thiếu ngày snapshot cần khôi phục." }, { status: 400 });
  }
  try {
    await restoreSnapshot(date);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Không khôi phục được snapshot.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
