"use client";

import type { GroupKind, Language } from "@/types/vocab";
import type { PersonalCollections } from "@/types/personal";

export async function loadPersonalCollections(): Promise<PersonalCollections> {
  const res = await fetch("/api/personal-lists");
  if (!res.ok) return { favorites: [], lists: [] };
  const data = await res.json();
  return data.collections ?? { favorites: [], lists: [] };
}

export async function toggleFavoriteGroup(
  language: Language,
  groupKind: GroupKind,
  groupId: string,
): Promise<PersonalCollections> {
  const res = await fetch("/api/personal-lists/favorite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language, groupKind, groupId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Không lưu được yêu thích.");
  return data.collections;
}

export async function createList(name: string): Promise<PersonalCollections> {
  const res = await fetch("/api/personal-lists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Không tạo được danh mục.");
  return data.collections;
}

export async function renameList(listId: string, name: string): Promise<PersonalCollections> {
  const res = await fetch(`/api/personal-lists/${listId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "rename", name }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Không đổi tên được danh mục.");
  return data.collections;
}

export async function deleteList(listId: string): Promise<PersonalCollections> {
  const res = await fetch(`/api/personal-lists/${listId}`, { method: "DELETE" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Không xoá được danh mục.");
  return data.collections;
}

export async function addItemToList(listId: string, itemId: string): Promise<PersonalCollections> {
  const res = await fetch(`/api/personal-lists/${listId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "add", itemId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Không thêm được vào danh mục.");
  return data.collections;
}

export async function removeItemFromList(listId: string, itemId: string): Promise<PersonalCollections> {
  const res = await fetch(`/api/personal-lists/${listId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "remove", itemId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Không bỏ được khỏi danh mục.");
  return data.collections;
}
