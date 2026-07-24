import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentRole } from "@/lib/currentSession";
import LogoutButton from "@/components/LogoutButton";
import ThemeProvider from "@/components/ThemeProvider";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { NO_FLASH_SCRIPT } from "@/lib/theme";

export const metadata: Metadata = {
  title: "SameSpell Learning",
  description: "Học từ vựng Trung / Hàn / Nhật qua các nhóm đồng âm dị nghĩa",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const role = await getCurrentRole();

  return (
    <html lang="vi" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col bg-surface text-ink" suppressHydrationWarning>
        <ThemeProvider>
          {role && (
            <header className="flex items-center justify-between bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-3 text-white shadow-md">
              <Link href="/" className="flex items-center gap-1.5 text-sm font-bold tracking-tight">
                <span className="text-lg">📖</span> SameSpell
              </Link>
              <div className="flex items-center gap-2">
                {role === "admin" && (
                  <Link
                    href="/admin"
                    className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium hover:bg-white/25"
                  >
                    Quản trị
                  </Link>
                )}
                <ThemeSwitcher />
                <LogoutButton />
              </div>
            </header>
          )}
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
