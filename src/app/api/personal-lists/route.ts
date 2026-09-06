import { NextRequest, NextResponse } from "next/server";
import { createListServer, loadPersonalCollections } from "@/lib/personalCollectionsStore";

export async function GET() {
  const collections = await loadPersonalCollections();
  return NextResponse.json({ collections });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = body?.name;
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Thiếu tên danh mục." }, { status: 400 });
  }
  try {
    const collections = await createListServer(name);
    return NextResponse.json({ collections });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Không tạo được danh mục." },
      { status: 500 },
    );
  }
}
