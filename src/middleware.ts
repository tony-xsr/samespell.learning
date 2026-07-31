import { NextRequest, NextResponse } from "next/server";
import { getSessionRole, SESSION_COOKIE } from "@/lib/session";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

function isPublicPath(pathname: string): boolean {
  if (pathname === "/login" || pathname === "/admin/login") return true;
  if (pathname.startsWith("/api/auth/")) return true;
  return false;
}

/** Vercel Cron gọi các route dưới `/api/cron/*` không kèm session cookie — Vercel tự đính kèm header
 * `Authorization: Bearer $CRON_SECRET` khi biến môi trường này được cấu hình trên project, nên xác
 * thực bằng secret thay vì session ở đây. */
function isAuthorizedCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/cron/")) {
    if (isAuthorizedCron(req)) return NextResponse.next();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const role = await getSessionRole(token);
  const isApi = pathname.startsWith("/api/");

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (role === "admin") return NextResponse.next();
    if (isApi) return NextResponse.json({ error: "Chưa đăng nhập admin." }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  if (role === "user" || role === "admin") {
    return NextResponse.next();
  }

  if (isApi) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}
