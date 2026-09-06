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
      className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-white/15 px-2 py-1 text-xs font-medium text-white hover:bg-white/25 sm:gap-1.5 sm:px-3"
    >
      <span>🚪</span>
      <span className="hidden sm:inline">Đăng xuất</span>
    </button>
  );
}
