import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { toFuriganaHtml } from "@/lib/jaFurigana";

const RequestSchema = z.object({
  text: z.string().min(1).max(500),
});

/** Sinh furigana cho 1 câu tiếng Nhật — PHẢI chạy ở server vì kuroshiro-analyzer-kuromoji chỉ hoạt
 * động ổn định trong Node (dùng fs + zlib thật để đọc từ điển nén); bản chạy trong trình duyệt của
 * kuromoji không tương thích với bundler hiện đại (xem ghi chú trong src/lib/jaFurigana.ts). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const html = await toFuriganaHtml(parsed.data.text);
  return NextResponse.json({ html });
}
