"use server";

import { redirect } from "next/navigation";
import { domainPaymentUrl, findByCode } from "@/lib/subscriptions";

/** Abre o pagamento da taxa de domínio (plano mensal em que a BudStack registra o domínio). */
export async function payDomainAction(form: FormData): Promise<void> {
  const sub = await findByCode(String(form.get("pedido") ?? ""));
  if (!sub || sub.status !== "PAID" || sub.cycle !== "MENSAL" || sub.domainOption !== "REGISTER" || sub.domainPaidAt) {
    redirect(`/assinar/obrigado?pedido=${encodeURIComponent(String(form.get("pedido") ?? ""))}`);
  }
  let url: string;
  try {
    url = await domainPaymentUrl(sub);
  } catch (err) {
    console.error("[obrigado] taxa de domínio:", err);
    redirect(`/assinar/obrigado?pedido=${sub.code}&erro=dominio`);
  }
  redirect(url);
}
