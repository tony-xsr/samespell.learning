import { NextRequest, NextResponse } from "next/server";
import { importBackupData } from "@/lib/backup";
import { getOffsite, isOffsiteConfigured, listOffsite } from "@/lib/backupOffsite";

export async function GET() {
  try {
    const configured = isOffsiteConfigured();
    const copies = configured ? await listOffsite() : [];
    return NextResponse.json({ configured, copies });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Không tải được danh sách bản sao ngoài server.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Khôi phục từ 1 bản sao ngoài server — dùng khi Redis trên server mất sạch (kể cả snapshot). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const date = typeof body?.date === "string" ? body.date : null;
  if (!date) {
    return NextResponse.json({ error: "Thiếu ngày của bản sao cần khôi phục." }, { status: 400 });
  }
  try {
    const data = await getOffsite(date);
    if (!data) throw new Error(`Không tìm thấy bản sao ngày ${date}.`);
    await importBackupData(data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Không khôi phục được bản sao.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
