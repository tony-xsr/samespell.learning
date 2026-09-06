import { NextRequest, NextResponse } from "next/server";
import { toggleFavoriteGroupServer } from "@/lib/personalCollectionsStore";
import type { GroupKind, Language } from "@/types/vocab";

const LANGUAGES: Language[] = ["zh", "ko", "ja", "en"];
const GROUP_KINDS: GroupKind[] = ["sound", "shape", "false-friend", "initial"];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { language, groupKind, groupId } = body ?? {};
  if (
    typeof groupId !== "string" ||
    !LANGUAGES.includes(language) ||
    !GROUP_KINDS.includes(groupKind)
  ) {
    return NextResponse.json({ error: "Thiếu hoặc sai language/groupKind/groupId." }, { status: 400 });
  }

  try {
    const collections = await toggleFavoriteGroupServer(language, groupKind, groupId);
    return NextResponse.json({ collections });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Không lưu được yêu thích." },
      { status: 500 },
    );
  }
}
