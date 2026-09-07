import type { Metadata } from "next";
import "./globals.css";
import { getCurrentRole } from "@/lib/currentSession";
import ThemeProvider from "@/components/ThemeProvider";
import SiteHeader from "@/components/SiteHeader";
import { NO_FLASH_SCRIPT } from "@/lib/theme";

export const metadata: Metadata = {
  title: "SameSpell Learning",
  description:
    "Học từ vựng và ngữ pháp Trung / Nhật / Hàn / Anh qua các trục dễ nhầm (đồng âm, đồng dạng, sai nghĩa), mindmap chủ đề, kịch bản hội thoại và bài kiểm tra tự sinh.",
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
          {role && <SiteHeader role={role} />}
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
