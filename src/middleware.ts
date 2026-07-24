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

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
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
