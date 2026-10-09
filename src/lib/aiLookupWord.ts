import type { VocabWord } from "@/types/vocab";

/** Biến kết quả MỘT lần tra AI (answer-card phẳng, xem AnswerCardView.tsx) thành một từ vựng thật để
 * lưu vào kho riêng của người học qua `saveLookupWord`. Xem Features.md mục 32.
 *
 * Trước đây các theme "card" chỉ ghi vào nhật ký `vocab:new-log` (tab "✨ Mới thêm" ở /my-vocab) — xem
 * lại được nhưng KHÔNG phải từ vựng: không vào SRS, không lọc được bằng "✚ Tự thêm", không đánh dấu
 * yêu thích/đã thuộc. Module này là chỗ duy nhất quyết định "card của theme X thì thành từ vựng ra sao",
 * để nhật ký và kho từ vựng luôn nhận cùng một dữ liệu.
 *
 * Nguồn vào là `card` PHẲNG (`Record<string, string>`) mà route đã dựng cho nhật ký, chứ không phải
 * object gốc của AI — một dữ liệu một đường đi, thêm theme mới chỉ phải khai báo ở một chỗ.
 *
 * Theme nào không tự sinh câu ví dụ (chiết tự, đồng nghĩa, cụm từ đi cùng...) thì `example` để chuỗi
 * rỗng — thà bỏ trống còn hơn nhồi một câu không phải AI nói ra. UI đã quen với ví dụ trống.
 */

/** Tên chữ gốc (một nhánh mindmap) cho từng theme trong nhóm "Từ tự tra", kèm mô tả nhánh. Nhãn phải
 * NGẮN vì nó là tên nhánh trên mindmap; mô tả nói rõ nhánh này chứa gì — nếu để mô tả lặp lại nhãn thì
 * node hiện hai lần cùng một chữ, chẳng thêm thông tin nào. */
const LOOKUP_THEMES: Record<string, { label: string; meaningVn: string }> = {
  "quick-dict": { label: "📖 Tra nhanh", meaningVn: "Từ bạn tra nghĩa/cách đọc" },
  etymology: { label: "🀄 Chiết tự", meaningVn: "Chữ bạn đã chẻ ra bộ thủ" },
  "explain-mnemonic": { label: "🧠 Giải thích sâu", meaningVn: "Từ bạn đã đào sắc thái và mẹo nhớ" },
  examples: { label: "📝 Ví dụ", meaningVn: "Từ bạn đã xin thêm câu ví dụ" },
  synonyms: { label: "🔗 Đồng nghĩa", meaningVn: "Từ bạn đã tìm từ gần nghĩa" },
  collocations: { label: "🧩 Cụm từ", meaningVn: "Từ bạn đã tìm cụm hay đi cùng" },
  idiom: { label: "🏮 Thành ngữ", meaningVn: "Thành ngữ/quán ngữ bạn đã phân tích" },
  sentence: { label: "✂️ Câu", meaningVn: "Câu bạn đã nhờ mổ xẻ" },
};

export function lookupThemeBranch(theme: string): { label: string; meaningVn: string } {
  return LOOKUP_THEMES[theme] ?? { label: theme, meaningVn: "Nội dung bạn đã tra" };
}

function parseList<T>(json: string | undefined): T[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/** Các mục trong danh sách của card (câu ví dụ, từ đồng nghĩa, chữ trong thành ngữ, khúc của câu) đều
 * tự nó là nội dung học được, nên thành TỪ CON của từ vừa tra — mindmap vẽ ra một nhánh hai tầng, và
 * mỗi mục con cũng vào SRS được như một từ bình thường.
 *
 * `id` để rỗng ở đây: module này thuần, không biết trong kho đã có từ con nào. `saveLookupWord` mới là
 * chỗ cấp id — và nó khớp lại theo `headword` để từ con đã có giữ nguyên id cũ (tiến độ SRS không mất
 * khi tra lại cùng một từ). */
function child(parts: {
  headword: string;
  reading?: string;
  meaningVn: string;
  example?: string;
  exampleVn?: string;
  wordClass?: string;
}): VocabWord {
  return {
    id: "",
    headword: parts.headword,
    reading: parts.reading ?? "",
    meaningVn: parts.meaningVn,
    example: parts.example ?? "",
    exampleVn: parts.exampleVn ?? "",
    ...(parts.wordClass ? { wordClass: parts.wordClass } : {}),
  };
}

/** Bỏ dấu câu ở hai đầu một khúc câu. Prompt "✂️ Mổ xẻ câu" BẮT BUỘC ghép các khúc lại phải ra đúng
 * câu gốc, nên AI đính dấu câu vào khúc đứng trước nó (vd "笑容，", "春心荡漾。") — đúng cho bảng phân
 * tích, nhưng lưu thành từ vựng thì phải sạch, không thì thẻ ôn tập hiện "笑容，". Thẻ card vẫn giữ
 * nguyên khúc có dấu. */
function stripPunctuation(text: string): string {
  return text.replace(/^[\s,.!?;:"'，。、！？；：“”‘’（）()《》…—]+|[\s,.!?;:"'，。、！？；：“”‘’（）()《》…—]+$/g, "");
}

export function lookupWordFromCard(
  theme: string,
  card: Record<string, string>,
): Omit<VocabWord, "id"> | null {
  const base = {
    reading: card.reading ?? "",
    ...(card.wordClass ? { wordClass: card.wordClass } : {}),
    ...(card.hanViet ? { hanViet: card.hanViet } : {}),
    ...(card.level ? { level: card.level } : {}),
    ...(card.mnemonicVn ? { mnemonicVn: card.mnemonicVn } : {}),
  };

  if (theme === "idiom") {
    if (!card.headword) return null;
    const breakdown = parseList<{ part: string; reading: string; meaningVn: string }>(card.breakdownJson);
    return {
      ...base,
      headword: card.headword,
      wordClass: card.wordClass || "thành ngữ",
      // Thành ngữ: nghĩa THẬT đứng trước, nghĩa mặt chữ đi kèm trong ngoặc — đúng thứ tự người học cần
      // khi gặp lại cụm này trong câu (biết nghĩa dùng trước, mặt chữ chỉ để nhớ cho vững).
      meaningVn: card.literalVn ? `${card.meaningVn} (mặt chữ: ${card.literalVn})` : card.meaningVn,
      example: card.example ?? "",
      exampleVn: card.exampleVn ?? "",
      // Điển tích/sắc thái chính là "mẹo nhớ" thật sự của một thành ngữ — biết tích là nhớ được cụm.
      mnemonicVn: [card.originVn, card.usageVn].filter(Boolean).join(" · ") || undefined,
      ...(breakdown.length > 0
        ? { children: breakdown.map((b) => child({ headword: b.part, reading: b.reading, meaningVn: b.meaningVn })) }
        : {}),
    };
  }

  if (theme === "sentence") {
    if (!card.sentence) return null;
    const chunks = parseList<{ text: string; reading: string; meaningVn: string; roleVn: string }>(card.chunksJson);
    return {
      ...base,
      headword: card.sentence,
      wordClass: "câu",
      meaningVn: card.translationVn ?? "",
      // Với một câu thì chính câu đó là ví dụ — để `example` trống thì thẻ ôn tập không có gì đọc lên.
      example: card.sentence,
      exampleVn: card.translationVn ?? "",
      mnemonicVn: [card.grammarVn, card.noteVn].filter(Boolean).join(" · ") || undefined,
      ...(chunks.length > 0
        ? {
            children: chunks
              .map((c) =>
                child({
                  headword: stripPunctuation(c.text),
                  reading: c.reading,
                  meaningVn: c.meaningVn,
                  wordClass: c.roleVn,
                }),
              )
              // Khúc chỉ có dấu câu (nếu AI tách riêng) không phải từ vựng — bỏ.
              .filter((c) => c.headword),
          }
        : {}),
    };
  }

  if (!card.headword) return null;

  if (theme === "etymology") {
    // Chiết tự không có trường "nghĩa của từ" — explanationVn (vì sao các thành phần ghép lại ra nghĩa
    // này) là thứ gần nhất, và cũng là nội dung người học muốn ôn lại.
    return {
      ...base,
      headword: card.headword,
      meaningVn: card.explanationVn ?? "",
      example: "",
      exampleVn: "",
      children: [
        child({
          headword: card.radical ?? "",
          meaningVn: `Bộ thủ — ${card.radicalMeaningVn ?? ""}`,
        }),
      ].filter((c) => c.headword),
    };
  }

  if (theme === "explain-mnemonic") {
    return {
      ...base,
      headword: card.headword,
      meaningVn: card.meaningVn ?? "",
      example: "",
      exampleVn: "",
      // explanationVn (dùng khi nào, khác gì từ gần nghĩa) đi cùng mẹo nhớ: cả hai đều là "cách nhớ và
      // dùng", và đây là trường văn xuôi duy nhất của VocabWord. Bản đầy đủ vẫn còn trong "✨ Mới thêm".
      mnemonicVn: [card.explanationVn, card.mnemonicVn].filter(Boolean).join(" 💡 ") || undefined,
    };
  }

  if (theme === "examples") {
    const examples = parseList<{ sentence: string; translationVn: string; contextVn?: string }>(card.examplesJson);
    const first = examples[0];
    return {
      ...base,
      headword: card.headword,
      meaningVn: card.meaningVn ?? "",
      example: first?.sentence ?? "",
      exampleVn: first?.translationVn ?? "",
      // Câu đầu lên thẳng thẻ từ (chỗ UI đọc `example`), các câu còn lại thành nhánh con để không mất.
      ...(examples.length > 1
        ? {
            children: examples.slice(1).map((ex) =>
              child({
                headword: ex.sentence,
                meaningVn: ex.translationVn,
                ...(ex.contextVn ? { wordClass: ex.contextVn } : {}),
              }),
            ),
          }
        : {}),
    };
  }

  if (theme === "synonyms") {
    const synonyms = parseList<{ word: string; reading: string; nuanceVn: string }>(card.synonymsJson);
    return {
      ...base,
      headword: card.headword,
      meaningVn: card.meaningVn ?? "",
      example: "",
      exampleVn: "",
      ...(synonyms.length > 0
        ? { children: synonyms.map((s) => child({ headword: s.word, reading: s.reading, meaningVn: s.nuanceVn })) }
        : {}),
    };
  }

  if (theme === "collocations") {
    const collocations = parseList<{ phrase: string; meaningVn: string }>(card.collocationsJson);
    return {
      ...base,
      headword: card.headword,
      meaningVn: card.meaningVn ?? "",
      example: "",
      exampleVn: "",
      ...(collocations.length > 0
        ? { children: collocations.map((c) => child({ headword: c.phrase, meaningVn: c.meaningVn })) }
        : {}),
    };
  }

  // Mặc định: "quick-dict" — card đã đúng hình dạng của một từ vựng, không phải nắn gì.
  return {
    ...base,
    headword: card.headword,
    meaningVn: card.meaningVn ?? "",
    example: card.example ?? "",
    exampleVn: card.exampleVn ?? "",
  };
}
