import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedPayment, getPayment, getPreapproval } from "@/lib/mercadopago";
import { codeFromReference, findByCode, reconcile } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

// Avisos do Mercado Pago (pagamentos e assinaturas).
// O aviso só diz QUAL recurso mudou; o estado real é sempre consultado na API em reconcile().
// Assim, um aviso falso não consegue marcar nada como pago.

export async function POST(req: NextRequest) {
  const url = req.nextUrl;
  const body = (await req.json().catch(() => ({}))) as { type?: string; topic?: string; data?: { id?: string | number } };
  const type = body.type || body.topic || url.searchParams.get("type") || url.searchParams.get("topic") || "";
  const id = String(body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");
  if (!id || !/^[\w-]{1,64}$/.test(id)) return NextResponse.json({ ok: true });

  try {
    const sub = await findSubscription(type, id);
    if (sub) await reconcile(sub);
    return NextResponse.json({ ok: true });
  } catch (err) {
    // 500 faz o Mercado Pago tentar de novo mais tarde
    console.error("[webhook mp]", type, id, err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

async function findSubscription(type: string, id: string) {
  switch (type) {
    case "payment": {
      const code = codeFromReference((await getPayment(id)).external_reference);
      return code ? findByCode(code) : null;
    }
    case "subscription_preapproval":
    case "preapproval": {
      const pre = await getPreapproval(id);
      const code = codeFromReference(pre.external_reference);
      return code ? findByCode(code) : prisma.subscription.findFirst({ where: { mpPreapprovalId: pre.id } });
    }
    case "subscription_authorized_payment":
    case "authorized_payment": {
      const ap = await getAuthorizedPayment(id);
      return ap.preapproval_id ? prisma.subscription.findFirst({ where: { mpPreapprovalId: ap.preapproval_id } }) : null;
    }
    default:
      return null;
  }
}
