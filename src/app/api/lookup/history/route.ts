import { NextRequest, NextResponse } from "next/server";
import type { Language } from "@/types/vocab";
import { getByHeadwords } from "@/lib/lookupIndex";
import { loadLookupHistory, recordLookup } from "@/lib/lookupHistoryStore";
import { getMnemonicMap } from "@/lib/mnemonicStore";

const LANGS: Language[] = ["zh", "ko", "ja", "en", "es"];

/** GET — các từ đã tra (mới nhất trước) kèm đủ thông tin để ôn: Hán Việt, mẹo nhớ (bản mới nhất), ví dụ. */
export async function GET() {
  try {
    const history = await loadLookupHistory();
    const items = [];
    for (const lang of LANGS) {
      const entries = history.filter((h) => h.lang === lang);
      if (entries.length === 0) continue;
      const [results, mnemonics] = await Promise.all([
        getByHeadwords(lang, entries.map((e) => e.headword)),
        getMnemonicMap(lang),
      ]);
      const at = new Map(entries.map((e) => [e.headword, e.at]));
      for (const r of results) items.push({ ...r, mnemonicVn: mnemonics[r.id] ?? r.mnemonicVn, lookedUpAt: at.get(r.headword) ?? 0 });
    }
    items.sort((a, b) => b.lookedUpAt - a.lookedUpAt);
    return NextResponse.json({ items });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Không tải được lịch sử tra.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST { lang, headword } — ghi 1 lần mở chi tiết từ trong bảng Tra nhanh. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const lang = LANGS.find((l) => l === body?.lang);
  const headword = typeof body?.headword === "string" ? body.headword.trim().slice(0, 40) : "";
  if (!lang || !headword) return NextResponse.json({ error: "Thiếu lang / headword." }, { status: 400 });
  try {
    await recordLookup(lang, headword);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Không lưu được lịch sử tra.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
