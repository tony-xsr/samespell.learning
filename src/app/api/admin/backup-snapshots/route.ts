import { NextResponse } from "next/server";
import { listSnapshots, saveSnapshot } from "@/lib/backupSnapshots";

export async function GET() {
  try {
    const snapshots = await listSnapshots();
    return NextResponse.json({ snapshots });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Không tải được danh sách snapshot.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Cho phép admin bấm "Sao lưu ngay" thủ công thay vì chỉ chờ cron chạy vào cuối ngày. */
export async function POST() {
  try {
    const { date } = await saveSnapshot();
    return NextResponse.json({ ok: true, date });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Không lưu được snapshot.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
