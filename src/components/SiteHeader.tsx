"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import LogoutButton from "@/components/LogoutButton";
import type { SessionRole } from "@/lib/session";

/** Ẩn header chung ở 2 trường hợp:
 * 1. Đang chơi 1 phiên Test (`/test/<lang>/<mode>`) — trang đó cố ý làm toàn màn hình, header đè lên
 *    vừa chiếm mất không gian (đáp án cuối bị hụt ra ngoài khung hình) vừa có nút đổi giao diện nằm
 *    ngay trên phần câu hỏi, dễ bấm nhầm. Trang chọn ngôn ngữ (`/test`) và chọn chế độ (`/test/<lang>`)
 *    vẫn giữ header bình thường vì không bị vấn đề tràn nội dung.
 * 2. Trang đăng nhập (`/login`, `/admin/login`) — `LoginForm` tự có nút đổi giao diện riêng ở góc
 *    (dành cho người CHƯA đăng nhập, không có header). Nếu 1 phiên đăng nhập cũ vẫn còn hiệu lực mà
 *    người dùng quay lại trang này, header chung sẽ hiện thêm 1 nút đổi giao diện thứ 2 chồng lên —
 *    bug phát hiện khi soi UI. Trang đăng nhập không cần điều hướng toàn app nên ẩn hẳn cho gọn. */
function shouldHideHeader(pathname: string): boolean {
  if (/^\/test\/[^/]+\/[^/]+/.test(pathname)) return true;
  if (pathname === "/login" || pathname === "/admin/login") return true;
  return false;
}

/** Nhãn full-text chỉ hiện từ `sm:` trở lên — dưới đó (điện thoại) chỉ hiện icon để pill không đủ
 * chỗ và bị vỡ chữ xuống 2-3 dòng (bug phát hiện khi soi UI di động: "Từ vựng của tôi"/"Thống kê"
 * từng bị bóp chữ xuống dòng ngay trong pill vì 5 phần tử header không đủ chỗ trên màn hình hẹp). */
function NavPill({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-white/15 px-2 py-1 text-xs font-medium hover:bg-white/25 sm:gap-1.5 sm:px-3"
    >
      <span>{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

export default function SiteHeader({ role }: { role: SessionRole }) {
  const pathname = usePathname();
  if (shouldHideHeader(pathname ?? "")) return null;

  return (
    <header className="flex items-center justify-between gap-2 bg-gradient-to-r from-brand-600 to-brand-500 px-3 py-3 text-white shadow-md sm:px-4">
      <Link href="/" className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm font-bold tracking-tight">
        <span className="text-lg">📖</span>
        <span>Rootlingo</span>
      </Link>
      <div className="flex min-w-0 items-center gap-1 overflow-x-auto sm:gap-2">
        <NavPill href="/my-vocab" icon="📚" label="Từ vựng của tôi" />
        <NavPill href="/stats" icon="📊" label="Thống kê" />
        {role === "admin" && <NavPill href="/admin" icon="🛠️" label="Quản trị" />}
        <div className="shrink-0">
          <ThemeSwitcher />
        </div>
        <div className="shrink-0">
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
