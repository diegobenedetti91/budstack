import { createHash, timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runBillingJobs } from "@/lib/billing";

export const dynamic = "force-dynamic";

// Rotina diária de cobrança (renovação do anual, atrasos, encerramentos).
// Agende no hPanel (Avançado → Cron Jobs), 1x por dia:
//   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://budstack.com.br/api/cron/billing

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

async function handle(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await runBillingJobs();
  return NextResponse.json({ ok: true, ...result });
}

export const GET = handle;
export const POST = handle;
