"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white hover:bg-white/25"
    >
      Đăng xuất
    </button>
  );
}
