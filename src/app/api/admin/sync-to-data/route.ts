import { NextResponse } from "next/server";
import { syncExtrasToStaticFiles } from "@/lib/syncToData";

export async function POST() {
  try {
    const results = await syncExtrasToStaticFiles();
    return NextResponse.json({ results });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Không gộp được dữ liệu vào data/.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
