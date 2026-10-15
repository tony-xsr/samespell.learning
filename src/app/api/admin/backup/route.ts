import { NextRequest, NextResponse } from "next/server";
import { exportBackupData, importBackupData, isValidBackup } from "@/lib/backup";

export async function GET() {
  try {
    const data = await exportBackupData();
    const filename = `samespell-backup-${new Date().toISOString().slice(0, 10)}.json`;
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Không xuất được backup.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!isValidBackup(body)) {
    return NextResponse.json(
      { error: "File backup không đúng định dạng." },
      { status: 400 },
    );
  }
  try {
    await importBackupData(body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Không khôi phục được backup.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
