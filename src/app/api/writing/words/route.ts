import { NextRequest, NextResponse } from "next/server";
import { buildVocabPool } from "@/lib/quiz/pool";
import { loadProgressStore } from "@/lib/progressStore";
import { loadWritingProgress, weakChars } from "@/lib/writingProgressStore";
import { toPinyin } from "@/lib/zhPinyin";

/** Từ tiếng Trung để luyện viết — chỉ những từ toàn chữ Hán (chữ Latinh/số không có dữ liệu nét).
 * - `source=learned`: từ đã có trong tiến độ ôn (đã học); `random`: cả kho từ; `weak`: các CHỮ lần gần
 *   nhất viết còn sai nét (xem writingProgressStore), mỗi chữ thành 1 mục luyện riêng.
 * - `maxLen` (mặc định 2): kho từ có rất nhiều thành ngữ 4 chữ / điển cố hiếm — người mới tập viết nên bắt
 *   đầu từ chữ đơn và từ 2 chữ thông dụng. */
const MAX_COUNT = 50;

interface PracticeItem {
  id: string;
  headword: string;
  reading: string;
  meaningVn: string;
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sourceParam = searchParams.get("source");
  const source = sourceParam === "learned" || sourceParam === "weak" ? sourceParam : "random";
  const count = Math.min(MAX_COUNT, Math.max(1, Number(searchParams.get("count")) || 20));
  const maxLen = Math.min(4, Math.max(1, Number(searchParams.get("maxLen")) || 2));
  const hanWord = new RegExp(`^\\p{Script=Han}{1,${maxLen}}$`, "u");

  try {
    const pool = await buildVocabPool("zh");
    const seen = new Set<string>();
    const allHan = pool.filter((w) => {
      if (!/^\p{Script=Han}+$/u.test(w.headword) || seen.has(w.headword)) return false;
      seen.add(w.headword);
      return true;
    });

    if (source === "weak") {
      const chars = weakChars(await loadWritingProgress());
      // Nghĩa của chữ: ưu tiên mục từ đúng 1 chữ đó, không có thì mượn từ ngắn nhất chứa chữ
      const items: PracticeItem[] = chars.slice(0, count).map((c) => {
        const single = allHan.find((w) => w.headword === c);
        if (single) return { id: single.id, headword: c, reading: single.reading, meaningVn: single.meaningVn };
        const host = allHan
          .filter((w) => w.headword.includes(c))
          .sort((a, b) => a.headword.length - b.headword.length)[0];
        return {
          id: `char:${c}`,
          headword: c,
          reading: toPinyin(c),
          meaningVn: host ? `trong “${host.headword}” — ${host.meaningVn}` : "",
        };
      });
      return NextResponse.json({ words: items, total: chars.length });
    }

    let words = allHan.filter((w) => hanWord.test(w.headword));
    if (source === "learned") {
      const progress = await loadProgressStore();
      words = words.filter((w) => progress[w.id]);
    }
    const picked: PracticeItem[] = shuffle(words)
      .slice(0, count)
      .map((w) => ({ id: w.id, headword: w.headword, reading: w.reading, meaningVn: w.meaningVn }));
    return NextResponse.json({ words: picked, total: words.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Không tải được danh sách từ.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
