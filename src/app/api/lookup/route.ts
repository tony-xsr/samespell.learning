import { NextRequest, NextResponse } from "next/server";
import type { Language } from "@/types/vocab";
import { buildHanViet, getHanVietMap, lookup } from "@/lib/lookupIndex";
import { getMnemonicMap } from "@/lib/mnemonicStore";
import { loadProgressStore } from "@/lib/progressStore";

const LANGS: Language[] = ["zh", "ko", "ja", "en", "es"];

/** GET /api/lookup?q=…&lang=zh|ko|… — tra nhanh toàn kho (xem lib/lookupIndex.ts). Mẹo nhớ và trạng thái
 * "đã thêm vào ôn tập" đọc MỚI mỗi lần (chỉ mục được cache vài phút), để mẹo vừa sinh bằng AI hiện ngay. */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").slice(0, 60);
  const lang = LANGS.find((l) => l === searchParams.get("lang")) ?? "zh";
  const limit = Math.min(40, Math.max(1, Number(searchParams.get("limit")) || 20));

  try {
    const [{ results, total }, mnemonics, progress, hvMap] = await Promise.all([
      lookup(lang, q, limit),
      getMnemonicMap(lang),
      loadProgressStore(),
      getHanVietMap(),
    ]);
    const enriched = results.map((r) => {
      const mnemonicVn = mnemonics[r.id] ?? r.mnemonicVn;
      // Tiếng Hàn: mẹo mới sinh thường ghi kèm Hanja cả từ → tách Hán Việt đầy đủ được ngay
      const hanViet =
        lang === "ko" && mnemonicVn !== r.mnemonicVn && (!r.hanViet || r.hanViet.partial)
          ? buildHanViet(lang, { headword: r.headword, meaningVn: r.meaningVn, mnemonicVn }, r.rootChar ? { character: r.rootChar, hanViet: r.rootHanViet } : undefined, r.groupReading, hvMap) ?? r.hanViet
          : r.hanViet;
      return { ...r, mnemonicVn, hanViet, inReview: !!progress[r.id], bookmarked: !!progress[r.id]?.bookmarked };
    });
    return NextResponse.json({ results: enriched, total });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Không tra được.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
