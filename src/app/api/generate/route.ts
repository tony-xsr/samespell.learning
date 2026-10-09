import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateStructured } from "@/lib/ai/generate";
import {
  ExpandRootSchema,
  NewRootSchema,
  QuickDictSchema,
  EtymologySchema,
  ExplainMnemonicSchema,
  ExampleSetSchema,
  SynonymSetSchema,
  CollocationSetSchema,
  IdiomSchema,
  SentenceAnalysisSchema,
} from "@/lib/ai/schemas";
import {
  buildExpandRootPrompt,
  buildNewRootPrompt,
  buildExpandWordPrompt,
  buildNewGroupPrompt,
  buildPolyphonicPrompt,
  buildSynonymFamilyPrompt,
  buildWordFamilyPrompt,
  buildQuickDictPrompt,
  buildEtymologyPrompt,
  buildExplainMnemonicPrompt,
  buildExamplesPrompt,
  buildSynonymsPrompt,
  buildCollocationsPrompt,
  buildIdiomPrompt,
  buildSentenceAnalysisPrompt,
} from "@/lib/ai/prompts";
import {
  addExtraWords,
  addExtraRoot,
  addWordChildren,
  addExtraGroup,
  getLanguageData,
  findGroupByReading,
  saveLookupWord,
} from "@/lib/vocabStore";
import { genId } from "@/lib/id";
import { logNewVocabEntry } from "@/lib/newVocabLog";
import { lookupWordFromCard, lookupThemeBranch } from "@/lib/aiLookupWord";
import type { Language, RootEntry, SoundGroup, VocabWord } from "@/types/vocab";

/** Mọi lần tra bằng theme "card" đều đi qua đây, nên MỌI truy vấn từ vựng vừa vào nhật ký "✨ Mới thêm"
 * vừa thành từ vựng thật trong nhóm "Từ tự tra" (lọc được bằng "✚ Tự thêm", ôn được bằng SRS). Trước
 * đây chỉ ghi nhật ký, nên người học tra xong là mất — xem Features.md mục 32.
 *
 * Lưu vào kho CHẠY TRƯỚC ghi nhật ký để nhật ký mang luôn `groupId` trỏ về nhóm vừa lưu. Lỗi khi lưu
 * kho KHÔNG được làm chết cả request: người học vẫn phải thấy kết quả tra của mình. */
async function persistLookup(params: {
  language: Language;
  theme: string;
  word: string;
  note: string;
  card: Record<string, string>;
}): Promise<{ groupId: string; wordId: string; replaced: boolean } | null> {
  const vocab = lookupWordFromCard(params.theme, params.card);
  let saved: { groupId: string; wordId: string; replaced: boolean } | null = null;
  if (vocab) {
    try {
      saved = await saveLookupWord(params.language, params.theme, lookupThemeBranch(params.theme), vocab);
    } catch {
      saved = null;
    }
  }
  await logNewVocabEntry({ ...params, groupId: saved?.groupId });
  return saved;
}

/** zh/ko/ja/en — TẤT CẢ mode trừ "etymology" (chiết tự chữ Hán/Kanji, không áp dụng tiếng Anh vì
 * không có Hán tự) đều dùng chung danh sách này. */
const ALL_LANGUAGES_ENUM = z.enum(["zh", "ko", "ja", "en", "es"]);

const RequestSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("expand-root"),
    language: ALL_LANGUAGES_ENUM,
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
    language: ALL_LANGUAGES_ENUM,
    groupId: z.string(),
    groupReading: z.string(),
    existingCharacters: z.array(z.string()).default([]),
  }),
  z.object({
    mode: z.literal("expand-word"),
    language: ALL_LANGUAGES_ENUM,
    wordId: z.string(),
    headword: z.string(),
    reading: z.string(),
    meaningVn: z.string(),
    existingChildHeadwords: z.array(z.string()).default([]),
  }),
  z.object({
    mode: z.literal("new-group"),
    language: ALL_LANGUAGES_ENUM,
    word: z.string().min(1),
    existingReadings: z.array(z.string()).default([]),
    /** "sound" | "polyphonic" | "synonym-family" (zh/ko/ja, xem Features.md mục 14.2) | "word-family"
     * (tiếng Anh — họ từ theo gốc Latin/Hy Lạp, xem mục 15). Tất cả trừ "sound" LUÔN tạo group riêng,
     * không gộp theo reading. */
    theme: z.enum(["sound", "polyphonic", "synonym-family", "word-family"]).default("sound"),
  }),
  z.object({
    mode: z.literal("quick-explain"),
    language: ALL_LANGUAGES_ENUM,
    word: z.string().min(1),
  }),
  z.object({
    mode: z.literal("etymology"),
    language: z.enum(["zh", "ja"]),
    word: z.string().min(1),
  }),
  z.object({
    mode: z.literal("explain-mnemonic"),
    language: ALL_LANGUAGES_ENUM,
    word: z.string().min(1),
  }),
  z.object({
    mode: z.literal("examples"),
    language: ALL_LANGUAGES_ENUM,
    word: z.string().min(1),
  }),
  z.object({
    mode: z.literal("synonyms"),
    language: ALL_LANGUAGES_ENUM,
    word: z.string().min(1),
  }),
  z.object({
    mode: z.literal("collocations"),
    language: ALL_LANGUAGES_ENUM,
    word: z.string().min(1),
  }),
  z.object({
    mode: z.literal("idiom"),
    language: ALL_LANGUAGES_ENUM,
    word: z.string().min(1),
  }),
  z.object({
    mode: z.literal("sentence"),
    language: ALL_LANGUAGES_ENUM,
    /** Cả MỘT CÂU, không phải 1 từ — nên không chẻ theo dấu phẩy ở client (xem splitWords trong
     * NewGroupPrompt.tsx) và cho phép dài hơn hẳn các mode khác. */
    word: z.string().min(1).max(500),
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
      const theme = input.theme;
      const prompt =
        theme === "polyphonic"
          ? buildPolyphonicPrompt({ language: input.language, word: input.word })
          : theme === "synonym-family"
            ? buildSynonymFamilyPrompt({ language: input.language, word: input.word })
            : theme === "word-family"
              ? buildWordFamilyPrompt({ word: input.word })
              : buildNewGroupPrompt({
                  language: input.language,
                  word: input.word,
                  existingReadings: input.existingReadings,
                });
      const result = await generateStructured(NewRootSchema, prompt);

      // Theme "polyphonic"/"synonym-family" không có khái niệm "cùng âm = cùng nhóm" (khác hẳn theme
      // mặc định "sound") — LUÔN tạo group riêng, không gộp theo reading.
      if (theme !== "sound") {
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
          // "word-family" (tiếng Anh) không có khái niệm reading riêng cho gốc từ — dùng luôn
          // "character" (chính gốc từ, vd "tract") làm tiêu đề nhóm, bất kể AI điền gì vào "reading".
          reading: theme === "word-family" ? result.character : result.reading,
          roots: [root],
          note: result.note,
          aiTheme: theme,
        };
        await addExtraGroup(input.language, group);
        const note = result.note ?? `Đã tạo mindmap "${theme}" mới cho chữ "${result.character}".`;
        await logNewVocabEntry({ language: input.language, theme, word: input.word, note, groupId: group.id });
        return NextResponse.json({ group, note });
      }

      // theme === "sound" — hành vi gốc: gộp vào nhóm đồng âm có sẵn nếu trùng cách đọc.
      // Đọc lại dữ liệu MỚI NHẤT (tĩnh + Redis) ngay trước khi ghi, để phát hiện nhóm đồng âm đã tồn
      // tại rồi — kể cả nhóm vừa được tạo bởi 1 từ khác trong CÙNG 1 lượt gửi nhiều từ liên tiếp từ
      // client (mode "new-group" gọi tuần tự) — thay vì luôn tạo nhóm mới gây trùng lặp đồng âm.
      const currentData = await getLanguageData(input.language);
      const existingGroup = currentData
        ? findGroupByReading(currentData, result.reading, input.language)
        : undefined;

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
        const mergeNote = `Đã gộp chữ "${result.character}" vào nhóm đồng âm "${existingGroup.reading}" có sẵn thay vì tạo nhóm mới.`;
        await logNewVocabEntry({
          language: input.language,
          theme,
          groupId: existingGroup.id,
          word: input.word,
          note: mergeNote,
        });
        return NextResponse.json({ group: { id: existingGroup.id }, note: mergeNote });
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
      const newGroupNote = `Đã tạo nhóm đồng âm mới "${group.reading}" cho chữ "${result.character}".`;
      await logNewVocabEntry({
        language: input.language,
        theme,
        groupId: group.id,
        word: input.word,
        note: newGroupNote,
      });
      return NextResponse.json({ group, note: newGroupNote });
    }

    if (input.mode === "quick-explain") {
      const prompt = buildQuickDictPrompt({ language: input.language, word: input.word });
      const result = await generateStructured(QuickDictSchema, prompt);
      const note = `Đã tra nhanh "${result.headword}".`;
      const card = {
        headword: result.headword,
        reading: result.reading,
        wordClass: result.wordClass ?? "",
        meaningVn: result.meaningVn,
        example: result.example,
        exampleVn: result.exampleVn,
      };
      const saved = await persistLookup({ language: input.language, theme: "quick-dict", word: input.word, note, card });
      return NextResponse.json({ card, saved });
    }

    if (input.mode === "etymology") {
      const prompt = buildEtymologyPrompt({ language: input.language, word: input.word });
      const result = await generateStructured(EtymologySchema, prompt);
      const note = `Đã chiết tự "${result.headword}".`;
      const card = {
        headword: result.headword,
        reading: result.reading,
        radical: result.radical,
        radicalMeaningVn: result.radicalMeaningVn,
        componentsVn: result.componentsVn,
        explanationVn: result.explanationVn,
        mnemonicVn: result.mnemonicVn,
      };
      const saved = await persistLookup({ language: input.language, theme: "etymology", word: input.word, note, card });
      return NextResponse.json({ card, saved });
    }

    if (input.mode === "explain-mnemonic") {
      const prompt = buildExplainMnemonicPrompt({ language: input.language, word: input.word });
      const result = await generateStructured(ExplainMnemonicSchema, prompt);
      const note = `Đã giải thích sâu & tạo mẹo nhớ cho "${result.headword}".`;
      const card = {
        headword: result.headword,
        reading: result.reading,
        meaningVn: result.meaningVn,
        explanationVn: result.explanationVn,
        mnemonicVn: result.mnemonicVn,
      };
      const saved = await persistLookup({ language: input.language, theme: "explain-mnemonic", word: input.word, note, card });
      return NextResponse.json({ card, saved });
    }

    if (input.mode === "examples") {
      const prompt = buildExamplesPrompt({ language: input.language, word: input.word });
      const result = await generateStructured(ExampleSetSchema, prompt);
      const note = `Đã tạo ví dụ minh hoạ cho "${result.headword}".`;
      const card = {
        headword: result.headword,
        reading: result.reading,
        meaningVn: result.meaningVn,
        examplesJson: JSON.stringify(result.examples),
      };
      const saved = await persistLookup({ language: input.language, theme: "examples", word: input.word, note, card });
      return NextResponse.json({ card, saved });
    }

    if (input.mode === "synonyms") {
      const prompt = buildSynonymsPrompt({ language: input.language, word: input.word });
      const result = await generateStructured(SynonymSetSchema, prompt);
      const note = `Đã tìm từ đồng nghĩa cho "${result.headword}".`;
      const card = {
        headword: result.headword,
        reading: result.reading,
        meaningVn: result.meaningVn,
        synonymsJson: JSON.stringify(result.synonyms),
      };
      const saved = await persistLookup({ language: input.language, theme: "synonyms", word: input.word, note, card });
      return NextResponse.json({ card, saved });
    }

    if (input.mode === "collocations") {
      const prompt = buildCollocationsPrompt({ language: input.language, word: input.word });
      const result = await generateStructured(CollocationSetSchema, prompt);
      const note = `Đã tìm cụm từ đi cùng "${result.headword}".`;
      const card = {
        headword: result.headword,
        reading: result.reading,
        meaningVn: result.meaningVn,
        collocationsJson: JSON.stringify(result.collocations),
      };
      const saved = await persistLookup({ language: input.language, theme: "collocations", word: input.word, note, card });
      return NextResponse.json({ card, saved });
    }

    if (input.mode === "idiom") {
      const prompt = buildIdiomPrompt({ language: input.language, word: input.word });
      const result = await generateStructured(IdiomSchema, prompt);
      const note = `Đã phân tích thành ngữ "${result.headword}".`;
      const card = {
        headword: result.headword,
        reading: result.reading,
        hanViet: result.hanViet ?? "",
        wordClass: result.wordClass,
        literalVn: result.literalVn,
        meaningVn: result.meaningVn,
        breakdownJson: JSON.stringify(result.breakdown),
        originVn: result.originVn,
        usageVn: result.usageVn,
        example: result.example,
        exampleVn: result.exampleVn,
        level: result.level ?? "",
      };
      const saved = await persistLookup({ language: input.language, theme: "idiom", word: input.word, note, card });
      return NextResponse.json({ card, saved });
    }

    if (input.mode === "sentence") {
      const prompt = buildSentenceAnalysisPrompt({ language: input.language, sentence: input.word });
      const result = await generateStructured(SentenceAnalysisSchema, prompt);
      const note = `Đã mổ xẻ câu "${result.sentence}".`;
      const card = {
        sentence: result.sentence,
        reading: result.reading,
        translationVn: result.translationVn,
        chunksJson: JSON.stringify(result.chunks),
        grammarVn: result.grammarVn,
        noteVn: result.noteVn,
      };
      const saved = await persistLookup({ language: input.language, theme: "sentence", word: input.word, note, card });
      return NextResponse.json({ card, saved });
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
