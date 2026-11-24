import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Primeira barreira: sem cookie de sessão, /conta e /admin vão para o login.
// A sessão e o papel (cliente/admin) são conferidos no banco por requireUser/requireAdmin
// em cada página e ação.
export function proxy(req: NextRequest) {
  if (req.cookies.get("bs_session")?.value) return NextResponse.next();
  const url = new URL("/entrar", req.url);
  url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/conta/:path*", "/admin/:path*"],
};
