import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateStructured } from "@/lib/ai/generate";
import { ExpandRootSchema, NewRootSchema } from "@/lib/ai/schemas";
import {
  buildExpandRootPrompt,
  buildNewRootPrompt,
  buildExpandWordPrompt,
  buildNewGroupPrompt,
} from "@/lib/ai/prompts";
import {
  addExtraWords,
  addExtraRoot,
  addWordChildren,
  addExtraGroup,
  getLanguageData,
  findGroupByReading,
} from "@/lib/vocabStore";
import { genId } from "@/lib/id";
import type { RootEntry, SoundGroup, VocabWord } from "@/types/vocab";

const RequestSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("expand-root"),
    language: z.enum(["zh", "ko", "ja"]),
    groupId: z.string(),
    rootId: z.string(),
    character: z.string(),
    meaningVn: z.string(),
    hanViet: z.string().optional(),
    existingHeadwords: z.array(z.string()).default([]),
    count: z.number().min(1).max(8).default(4),
  }),
  z.object({
    mode: z.literal("new-root"),
    language: z.enum(["zh", "ko", "ja"]),
    groupId: z.string(),
    groupReading: z.string(),
    existingCharacters: z.array(z.string()).default([]),
  }),
  z.object({
    mode: z.literal("expand-word"),
    language: z.enum(["zh", "ko", "ja"]),
    wordId: z.string(),
    headword: z.string(),
    reading: z.string(),
    meaningVn: z.string(),
    existingChildHeadwords: z.array(z.string()).default([]),
  }),
  z.object({
    mode: z.literal("new-group"),
    language: z.enum(["zh", "ko", "ja"]),
    word: z.string().min(1),
    existingReadings: z.array(z.string()).default([]),
  }),
]);

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body không phải JSON hợp lệ." }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const input = parsed.data;

  try {
    if (input.mode === "expand-root") {
      const prompt = buildExpandRootPrompt({
        language: input.language,
        character: input.character,
        hanViet: input.hanViet,
        meaningVn: input.meaningVn,
        existingHeadwords: input.existingHeadwords,
        count: input.count,
      });
      const result = await generateStructured(ExpandRootSchema, prompt);
      const words: VocabWord[] = result.words.map((w) => ({ ...w, id: genId("word") }));
      await addExtraWords(input.language, input.rootId, words);
      return NextResponse.json({ words });
    }

    if (input.mode === "expand-word") {
      const prompt = buildExpandWordPrompt({
        language: input.language,
        headword: input.headword,
        reading: input.reading,
        meaningVn: input.meaningVn,
        existingChildHeadwords: input.existingChildHeadwords,
      });
      const result = await generateStructured(ExpandRootSchema, prompt);
      const children: VocabWord[] = result.words.map((w) => ({ ...w, id: genId("word") }));
      await addWordChildren(input.language, input.wordId, children);
      return NextResponse.json({ children });
    }

    if (input.mode === "new-group") {
      const prompt = buildNewGroupPrompt({
        language: input.language,
        word: input.word,
        existingReadings: input.existingReadings,
      });
      const result = await generateStructured(NewRootSchema, prompt);

      // Đọc lại dữ liệu MỚI NHẤT (tĩnh + Redis) ngay trước khi ghi, để phát hiện nhóm đồng âm đã tồn
      // tại rồi — kể cả nhóm vừa được tạo bởi 1 từ khác trong CÙNG 1 lượt gửi nhiều từ liên tiếp từ
      // client (mode "new-group" gọi tuần tự) — thay vì luôn tạo nhóm mới gây trùng lặp đồng âm.
      const currentData = await getLanguageData(input.language);
      const existingGroup = currentData ? findGroupByReading(currentData, result.reading) : undefined;

      if (existingGroup) {
        const alreadyHasCharacter = existingGroup.roots.some((r) => r.character === result.character);
        if (alreadyHasCharacter) {
          return NextResponse.json({
            group: { id: existingGroup.id },
            note: `Chữ "${result.character}" đã có sẵn trong nhóm đồng âm "${existingGroup.reading}" rồi, mở nhóm đó luôn thay vì tạo trùng.`,
          });
        }
        const root: RootEntry = {
          id: genId("root"),
          character: result.character,
          hanViet: result.hanViet,
          meaningVn: result.meaningVn,
          reading: result.reading,
          words: result.words.map((w) => ({ ...w, id: genId("word") })),
        };
        await addExtraRoot(input.language, existingGroup.id, root);
        return NextResponse.json({
          group: { id: existingGroup.id },
          note: `Đã gộp chữ "${result.character}" vào nhóm đồng âm "${existingGroup.reading}" có sẵn thay vì tạo nhóm mới.`,
        });
      }

      const root: RootEntry = {
        id: genId("root"),
        character: result.character,
        hanViet: result.hanViet,
        meaningVn: result.meaningVn,
        reading: result.reading,
        words: result.words.map((w) => ({ ...w, id: genId("word") })),
      };
      const group: SoundGroup = {
        id: genId("group"),
        language: input.language,
        reading: result.reading,
        roots: [root],
      };
      await addExtraGroup(input.language, group);
      return NextResponse.json({
        group,
        note: `Đã tạo nhóm đồng âm mới "${group.reading}" cho chữ "${result.character}".`,
      });
    }

    // mode === "new-root"
    const prompt = buildNewRootPrompt({
      language: input.language,
      groupReading: input.groupReading,
      existingCharacters: input.existingCharacters,
    });
    const result = await generateStructured(NewRootSchema, prompt);
    const root: RootEntry = {
      id: genId("root"),
      character: result.character,
      hanViet: result.hanViet,
      meaningVn: result.meaningVn,
      reading: result.reading,
      words: result.words.map((w) => ({ ...w, id: genId("word") })),
    };
    await addExtraRoot(input.language, input.groupId, root);
    return NextResponse.json({ root });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lỗi không xác định khi gọi AI.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
