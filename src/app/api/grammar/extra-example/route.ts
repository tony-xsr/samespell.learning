import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateStructured } from "@/lib/ai/generate";
import { GrammarExampleSchema } from "@/lib/ai/schemas";
import { buildGrammarExtraExamplePrompt } from "@/lib/ai/prompts";
import { addGrammarExtraExample } from "@/lib/grammarExtras";

const RequestSchema = z.object({
  language: z.enum(["zh", "ko", "ja"]),
  pointId: z.string(),
  pattern: z.string(),
  meaningVn: z.string(),
  nuanceVn: z.string(),
  existingSentences: z.array(z.string()),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const input = parsed.data;

  try {
    const prompt = buildGrammarExtraExamplePrompt(input);
    const result = await generateStructured(GrammarExampleSchema, prompt);
    const examples = await addGrammarExtraExample(input.language, input.pointId, result);
    return NextResponse.json({ examples });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lỗi không xác định khi gọi AI." },
      { status: 502 },
    );
  }
}
