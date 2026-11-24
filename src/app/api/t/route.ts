import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { BOT_UA, DIRECT, detectAttribution, type Attribution } from "@/lib/tracking";

export const dynamic = "force-dynamic";

// Beacon de visita: { path, href, ref }. Guarda um id anônimo (cookie bs_vid) e a primeira origem
// conhecida (cookie bs_src, 30 dias), que é ligada à assinatura no checkout. Sem dados pessoais.

const VID = "bs_vid";
const SRC = "bs_src";
const MONTH = 30 * 24 * 3600;

export async function POST(req: NextRequest) {
  const ua = req.headers.get("user-agent");
  if (!ua || BOT_UA.test(ua)) return new NextResponse(null, { status: 204 });

  const body = (await req.json().catch(() => null)) as { path?: string; href?: string; ref?: string } | null;
  const path = typeof body?.path === "string" ? body.path.split("?")[0].slice(0, 200) : "";
  if (!path.startsWith("/") || path.startsWith("/admin") || path.startsWith("/conta") || path.startsWith("/api")) return new NextResponse(null, { status: 204 });

  let pageUrl: URL;
  try {
    pageUrl = new URL(typeof body?.href === "string" ? body.href : path, req.nextUrl.origin);
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  let visitorId = req.cookies.get(VID)?.value ?? "";
  if (!/^[\w-]{16,40}$/.test(visitorId)) visitorId = randomBytes(12).toString("base64url");

  const detected = detectAttribution(pageUrl, typeof body?.ref === "string" ? body.ref : null, ua, req.nextUrl.hostname);
  let stored: Attribution | null = null;
  try {
    stored = JSON.parse(req.cookies.get(SRC)?.value ?? "null");
  } catch {}
  // Último canal identificado vale; visita direta não apaga o que já se sabia
  const attr = detected ?? stored ?? DIRECT;

  await prisma.pageView.create({ data: { visitorId, path, source: attr.source, medium: attr.medium, campaign: attr.campaign } }).catch((e) => console.error("[t]", e));

  const res = new NextResponse(null, { status: 204 });
  const opts = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: MONTH };
  res.cookies.set(VID, visitorId, { ...opts, maxAge: 12 * MONTH });
  if (detected) res.cookies.set(SRC, JSON.stringify(detected), opts);
  return res;
}
