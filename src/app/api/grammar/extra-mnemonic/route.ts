import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateStructured } from "@/lib/ai/generate";
import { MnemonicSchema } from "@/lib/ai/schemas";
import { buildGrammarExtraMnemonicPrompt } from "@/lib/ai/prompts";
import { addGrammarExtraMnemonic } from "@/lib/grammarExtras";

const RequestSchema = z.object({
  language: z.enum(["zh", "ko", "ja"]),
  pointId: z.string(),
  pattern: z.string(),
  meaningVn: z.string(),
  nuanceVn: z.string(),
  existingTips: z.array(z.string()),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const input = parsed.data;

  try {
    const prompt = buildGrammarExtraMnemonicPrompt(input);
    const result = await generateStructured(MnemonicSchema, prompt);
    const mnemonics = await addGrammarExtraMnemonic(input.language, input.pointId, result.mnemonicVn);
    return NextResponse.json({ mnemonics });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lỗi không xác định khi gọi AI." },
      { status: 502 },
    );
  }
}
