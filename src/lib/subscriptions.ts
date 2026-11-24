import "server-only";
import { randomBytes } from "crypto";
import type { Subscription } from "@prisma/client";
import { prisma } from "./prisma";
import { ANNUAL_MAX_INSTALLMENTS, DOMAIN_FEE_CENTS, getPlan, planPriceCents, type Cycle, type Plan } from "./plans";
import { createPreapproval, createPreference, getPreapproval, searchPayments, siteUrl, type MpPayment } from "./mercadopago";
import { notifyDomainPaid, notifyPaid } from "./notify";

const DOMAIN_SUFFIX = "-DOMINIO";

/** Código curto e legível (sem 0/O/1/I), ex.: BS-7K2M9Q */
function newCode(): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = randomBytes(6);
  return "BS-" + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function thankYouUrl(code: string): string {
  return `${siteUrl()}/assinar/obrigado?pedido=${code}`;
}

export interface NewSubscriptionInput {
  plan: Plan;
  cycle: Cycle;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerDocument: string;
  storeName: string;
  domainOption: "OWN" | "REGISTER";
  domain: string;
}

/** Cria a assinatura e o pagamento no Mercado Pago. Retorna o link para onde o cliente vai pagar. */
export async function startSubscription(input: NewSubscriptionInput): Promise<string> {
  const planCents = planPriceCents(input.plan, input.cycle);
  const domainFee = input.domainOption === "REGISTER" ? DOMAIN_FEE_CENTS : 0;
  // Anual: taxa do domínio entra no mesmo pagamento. Mensal: é cobrada à parte, depois.
  const total = input.cycle === "ANUAL" ? planCents + domainFee : planCents;

  const sub = await prisma.subscription.create({
    data: {
      code: newCode(),
      plan: input.plan.id,
      cycle: input.cycle,
      planPriceCents: planCents,
      domainFeeCents: domainFee,
      totalCents: total,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      customerDocument: input.customerDocument,
      storeName: input.storeName,
      domainOption: input.domainOption,
      domain: input.domain,
    },
  });

  const title = `VirtualStore ${input.plan.name} · ${input.cycle === "ANUAL" ? "anual" : "mensal"}`;
  try {
    if (input.cycle === "ANUAL") {
      const pref = await createPreference({
        externalReference: sub.code,
        title: domainFee ? `${title} + registro de domínio` : title,
        amountCents: total,
        payerEmail: sub.customerEmail,
        payerName: sub.customerName,
        maxInstallments: ANNUAL_MAX_INSTALLMENTS,
        backUrl: thankYouUrl(sub.code),
      });
      await prisma.subscription.update({ where: { id: sub.id }, data: { mpPreferenceId: pref.id } });
      return pref.init_point;
    }

    const pre = await createPreapproval({
      externalReference: sub.code,
      reason: title,
      amountCents: planCents,
      payerEmail: sub.customerEmail,
      backUrl: thankYouUrl(sub.code),
    });
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { mpPreapprovalId: pre.id, mpSubscriptionStatus: pre.status },
    });
    if (!pre.init_point) throw new Error("Mercado Pago não devolveu o link da assinatura");
    return pre.init_point;
  } catch (err) {
    // Sem link de pagamento a assinatura não serve para nada: marca como cancelada
    await prisma.subscription.update({ where: { id: sub.id }, data: { status: "CANCELLED", notes: `Falha ao criar pagamento: ${String(err).slice(0, 400)}` } });
    throw err;
  }
}

/** Link de pagamento da taxa de domínio (plano mensal com REGISTER). Reaproveita o link se já existir. */
export async function domainPaymentUrl(sub: Subscription): Promise<string> {
  if (sub.domainOption !== "REGISTER" || sub.cycle !== "MENSAL" || sub.domainPaidAt) throw new Error("Taxa de domínio não se aplica");
  const pref = await createPreference({
    externalReference: sub.code + DOMAIN_SUFFIX,
    title: `Registro do domínio ${sub.domain} (1 ano)`,
    amountCents: sub.domainFeeCents,
    payerEmail: sub.customerEmail,
    payerName: sub.customerName,
    maxInstallments: 1,
    backUrl: thankYouUrl(sub.code),
  });
  await prisma.subscription.update({ where: { id: sub.id }, data: { mpDomainPreferenceId: pref.id } });
  return pref.init_point;
}

/** Código da assinatura a partir do external_reference de um pagamento (tira o sufixo do domínio). */
export function codeFromReference(ref: string | null | undefined): string | null {
  if (!ref || !ref.startsWith("BS-")) return null;
  return ref.endsWith(DOMAIN_SUFFIX) ? ref.slice(0, -DOMAIN_SUFFIX.length) : ref;
}

function approvedCovering(payments: MpPayment[], cents: number): MpPayment | undefined {
  return payments.find((p) => p.status === "approved" && Math.round(Number(p.transaction_amount) * 100) >= cents);
}

/**
 * Consulta o Mercado Pago e atualiza a assinatura. Seguro para chamar várias vezes
 * (webhook repetido, página de obrigado, botão do painel): o aviso sai só uma vez.
 */
export async function reconcile(sub: Subscription): Promise<Subscription> {
  if (sub.cycle === "ANUAL") {
    const payments = await searchPayments(sub.code);
    const ok = approvedCovering(payments, sub.totalCents);
    if (ok) {
      await markPaid(sub, String(ok.id), sub.domainOption === "REGISTER");
    } else if (sub.status === "PAID" && payments.some((p) => p.status === "refunded" || p.status === "charged_back")) {
      await prisma.subscription.update({ where: { id: sub.id }, data: { status: "CANCELLED", stage: "CANCELADO" } });
    }
  } else if (sub.mpPreapprovalId) {
    const pre = await getPreapproval(sub.mpPreapprovalId);
    if (pre.status !== sub.mpSubscriptionStatus) {
      await prisma.subscription.update({ where: { id: sub.id }, data: { mpSubscriptionStatus: pre.status } });
    }
    const charged = (pre.summarized?.charged_quantity ?? 0) >= 1;
    if (charged && pre.status !== "cancelled") await markPaid(sub, null, false);
    if (pre.status === "cancelled" && sub.status === "PAID") {
      await prisma.subscription.update({ where: { id: sub.id }, data: { status: "CANCELLED" } });
    }
  }

  // Taxa de domínio paga à parte (plano mensal)
  if (sub.cycle === "MENSAL" && sub.domainOption === "REGISTER" && !sub.domainPaidAt) {
    const ok = approvedCovering(await searchPayments(sub.code + DOMAIN_SUFFIX), sub.domainFeeCents);
    if (ok) {
      const { count } = await prisma.subscription.updateMany({ where: { id: sub.id, domainPaidAt: null }, data: { domainPaidAt: new Date() } });
      const fresh = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
      // Se a assinatura já tinha sido avisada, manda o aviso curto do domínio
      if (count === 1 && fresh.notifiedAt) await notifyDomainPaid(fresh).catch((e) => console.error("[reconcile] aviso de domínio:", e));
    }
  }

  return prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
}

async function markPaid(sub: Subscription, paymentId: string | null, domainPaid: boolean): Promise<void> {
  // Condicional: só quem efetivamente muda de "não pago" para "pago" dispara o aviso
  const { count } = await prisma.subscription.updateMany({
    where: { id: sub.id, paidAt: null, status: { not: "CANCELLED" } },
    data: {
      status: "PAID",
      paidAt: new Date(),
      ...(paymentId ? { mpPaymentId: paymentId } : {}),
      ...(domainPaid ? { domainPaidAt: new Date() } : {}),
    },
  });
  if (count !== 1) return;

  const fresh = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
  try {
    if (await notifyPaid(fresh)) {
      await prisma.subscription.update({ where: { id: sub.id }, data: { notifiedAt: new Date() } });
    }
  } catch (err) {
    console.error("[reconcile] aviso de pagamento falhou:", err);
  }
}

export async function findByCode(code: string): Promise<Subscription | null> {
  if (!/^BS-[A-Z0-9]{6}$/.test(code)) return null;
  return prisma.subscription.findUnique({ where: { code } });
}

export { getPlan };
