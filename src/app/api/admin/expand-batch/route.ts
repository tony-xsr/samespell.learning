import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runExpandBatch } from "@/lib/ai/expandBatch";

export const maxDuration = 60;

const BodySchema = z.object({
  language: z.enum(["zh", "ko", "ja"]).optional(),
  maxActions: z.number().min(1).max(20).optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  try {
    const result = await runExpandBatch(parsed.data);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lỗi không xác định." },
      { status: 500 },
    );
  }
}
