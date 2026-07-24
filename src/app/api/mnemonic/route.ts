import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateStructured } from "@/lib/ai/generate";
import { MnemonicSchema } from "@/lib/ai/schemas";
import { buildMnemonicPrompt } from "@/lib/ai/prompts";
import { setMnemonic } from "@/lib/mnemonicStore";

const RequestSchema = z.object({
  language: z.enum(["zh", "ko", "ja"]),
  wordId: z.string(),
  headword: z.string(),
  reading: z.string(),
  meaningVn: z.string(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const input = parsed.data;

  try {
    const prompt = buildMnemonicPrompt(input);
    const result = await generateStructured(MnemonicSchema, prompt);
    await setMnemonic(input.language, input.wordId, result.mnemonicVn);
    return NextResponse.json({ mnemonicVn: result.mnemonicVn });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lỗi không xác định khi gọi AI." },
      { status: 502 },
    );
  }
}
