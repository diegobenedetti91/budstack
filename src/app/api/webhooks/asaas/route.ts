import { createHash, timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPayment } from "@/lib/asaas";
import { findByReference, reconcile } from "@/lib/billing";

export const dynamic = "force-dynamic";

// Webhook do Asaas (eventos de cobrança). O Asaas envia o token configurado no cabeçalho "asaas-access-token".
// Eventos repetidos são ignorados (o Asaas entrega "pelo menos uma vez"). O estado real da cobrança é
// consultado na API antes de mudar qualquer coisa (reconcile).

function tokenOk(got: string): boolean {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!expected) return false;
  const a = createHash("sha256").update(got).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!tokenOk(req.headers.get("asaas-access-token") ?? "")) return new NextResponse("Não autorizado", { status: 401 });
  const evt = (await req.json().catch(() => null)) as { id?: string; event?: string; payment?: { id?: string; subscription?: string | null; externalReference?: string | null } } | null;
  if (!evt?.id || !evt.event) return NextResponse.json({ ok: true });
  const paymentId = evt.payment?.id;
  if (!paymentId || !/^[\w-]{1,64}$/.test(paymentId)) return NextResponse.json({ ok: true });

  // Já processado? (o registro é feito só depois de processar com sucesso)
  if (await prisma.webhookEvent.findUnique({ where: { id: evt.id.slice(0, 120) } })) return NextResponse.json({ ok: true, duplicate: true });

  try {
    const payment = await getPayment(paymentId);
    const sub =
      (payment.subscription ? await prisma.subscription.findFirst({ where: { asaasSubscriptionId: payment.subscription } }) : null) ??
      (await prisma.invoice.findUnique({ where: { asaasPaymentId: payment.id }, include: { subscription: true } }))?.subscription ??
      (await findByReference(payment.externalReference));
    if (sub && sub.provider === "ASAAS") await reconcile(sub);
    await prisma.webhookEvent.create({ data: { id: evt.id.slice(0, 120), provider: "asaas", type: evt.event.slice(0, 60) } }).catch(() => null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Erro nosso: 500 faz o Asaas tentar de novo mais tarde
    console.error("[webhook asaas]", evt.event, paymentId, err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
