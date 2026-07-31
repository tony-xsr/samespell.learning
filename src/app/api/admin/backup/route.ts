import { NextRequest, NextResponse } from "next/server";
import { exportBackupData, importBackupData, type BackupData } from "@/lib/backup";

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

/** Chấp nhận cả backup version 1 cũ (chưa có progressHistory/grammarProgress*) lẫn version 2 hiện
 * tại — `importBackupData` đã tự điền `{}` cho các field version-2 bị thiếu khi phục hồi file cũ. */
function isValidBackup(body: unknown): body is BackupData {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    (b.version === 1 || b.version === 2) &&
    typeof b.progress === "object" &&
    b.progress !== null &&
    typeof b.vocabExtra === "object" &&
    b.vocabExtra !== null &&
    typeof b.mnemonics === "object" &&
    b.mnemonics !== null
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!isValidBackup(body)) {
    return NextResponse.json(
      { error: "File backup không đúng định dạng (thiếu version/progress/vocabExtra/mnemonics)." },
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
