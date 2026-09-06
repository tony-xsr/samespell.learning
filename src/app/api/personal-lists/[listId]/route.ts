import { NextRequest, NextResponse } from "next/server";
import {
  addItemToListServer,
  deleteListServer,
  removeItemFromListServer,
  renameListServer,
} from "@/lib/personalCollectionsStore";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ listId: string }> }) {
  const { listId } = await params;
  const body = await req.json().catch(() => null);

  try {
    if (body?.action === "rename" && typeof body.name === "string" && body.name.trim()) {
      const collections = await renameListServer(listId, body.name);
      return NextResponse.json({ collections });
    }
    if (body?.action === "add" && typeof body.itemId === "string") {
      const collections = await addItemToListServer(listId, body.itemId);
      return NextResponse.json({ collections });
    }
    if (body?.action === "remove" && typeof body.itemId === "string") {
      const collections = await removeItemFromListServer(listId, body.itemId);
      return NextResponse.json({ collections });
    }
    return NextResponse.json({ error: "action không hợp lệ." }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Không cập nhật được danh mục." },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ listId: string }> }) {
  const { listId } = await params;
  try {
    const collections = await deleteListServer(listId);
    return NextResponse.json({ collections });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Không xoá được danh mục." },
      { status: 500 },
    );
  }
}
