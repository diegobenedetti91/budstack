import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, isValidSession } from "@/lib/session";

// Primeira barreira do painel: sem sessão válida, /admin/* vai para o login.
// As páginas e ações do admin conferem de novo com requireAdmin().
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const logged = isValidSession(req.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/admin/login") {
    return logged ? NextResponse.redirect(new URL("/admin", req.url)) : NextResponse.next();
  }
  if (!logged) return NextResponse.redirect(new URL("/admin/login", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
