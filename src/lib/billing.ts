import "server-only";
import { randomBytes } from "crypto";
import type { Invoice, Subscription } from "@prisma/client";
import { prisma } from "./prisma";
import { getSettings } from "./settings";
import { planNames, planPriceCents, type Cycle, type PlanView } from "./plans";
import {
  cancelPreapproval,
  createPreapproval,
  createPreference,
  getPreapproval,
  refundPayment,
  searchAuthorizedPayments,
  searchPayments,
  siteUrl,
  type MpPayment,
} from "./mercadopago";
import { emailCustomer, notifyNewPaid, notifyOwner, subscriptionSummary } from "./notify";
import { money } from "./format";

/**
 * Regras de assinatura (padrão de mercado + Código de Defesa do Consumidor):
 *  - Mensal: assinatura no cartão do Mercado Pago, cobrada todo mês. Anual: pagamento único (Pix ou cartão
 *    parcelado); alguns dias antes do vencimento o cliente recebe o link da renovação, com lembretes.
 *  - Cancelar quando quiser, sem multa: o acesso segue até o fim do período pago e nada mais é cobrado.
 *    Dá para desfazer antes do fim do período.
 *  - Arrependimento (CDC art. 49): até N dias (padrão 7) do 1º pagamento, cancelamento com reembolso integral.
 *  - Pagamento não confirmado: assinatura "em atraso" com tolerância de N dias (padrão 7) e avisos ao cliente.
 *    Sem pagamento, é encerrada sem multa e você é avisado para suspender a loja.
 *  - O preço de cada assinatura fica congelado: mudar o preço do plano não afeta quem já assinou.
 */

export class BillingError extends Error {}

const DAY = 864e5;
const LIVE = ["PENDING", "ACTIVE", "PAST_DUE"];

export function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  const day = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + n);
  r.setUTCDate(Math.min(day, new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate()));
  return r;
}
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
export const dateBR = (d: Date | null | undefined) => (d ? d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");
const cycleWord = (c: string) => (c === "ANUAL" ? "anual" : "mensal");

function newCode(): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  return "BS-" + Array.from(randomBytes(6), (b) => alphabet[b % alphabet.length]).join("");
}

async function event(subscriptionId: string, kind: string, amountCents = 0, detail?: string) {
  await prisma.subscriptionEvent.create({ data: { subscriptionId, kind, amountCents, detail: detail?.slice(0, 500) } });
}

async function planName(id: string): Promise<string> {
  return (await planNames()).get(id) ?? id;
}

function hasReminder(s: Subscription, key: string): boolean {
  try {
    return (JSON.parse(s.reminders) as string[]).includes(key);
  } catch {
    return false;
  }
}
async function addReminder(s: Subscription, key: string): Promise<boolean> {
  if (hasReminder(s, key)) return false;
  let list: string[] = [];
  try {
    list = JSON.parse(s.reminders);
  } catch {}
  const reminders = JSON.stringify([...list, key].slice(-30));
  await prisma.subscription.update({ where: { id: s.id }, data: { reminders } });
  s.reminders = reminders;
  return true;
}

const thankYou = (code: string) => `${siteUrl()}/assinar/obrigado?pedido=${code}`;

// ───────── Início ─────────

export interface StartInput {
  userId: string;
  plan: PlanView;
  cycle: Cycle;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerDocument: string;
  storeName: string;
  domainOption: "OWN" | "REGISTER";
  domain: string;
  attribution: { visitorId?: string | null; source?: string | null; medium?: string | null; campaign?: string | null };
}

/** Cria a assinatura e o pagamento no Mercado Pago. Retorna o link para onde o cliente vai pagar. */
export async function startSubscription(input: StartInput): Promise<string> {
  const s = await getSettings();
  const planCents = planPriceCents(input.plan, input.cycle, s);
  const domainFee = input.domainOption === "REGISTER" ? s.domain_fee_cents : 0;
  const total = input.cycle === "ANUAL" ? planCents + domainFee : planCents;

  const sub = await prisma.subscription.create({
    data: {
      code: newCode(),
      userId: input.userId,
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
      visitorId: input.attribution.visitorId ?? null,
      source: input.attribution.source ?? null,
      medium: input.attribution.medium ?? null,
      campaign: input.attribution.campaign ?? null,
    },
  });
  await event(sub.id, "created", total, `${input.plan.name} ${cycleWord(input.cycle)}`);

  const title = `VirtualStore ${input.plan.name} · ${cycleWord(input.cycle)}`;
  try {
    if (input.cycle === "ANUAL") {
      const inv = await createPaymentInvoice(sub, {
        kind: "PLAN",
        amountCents: total,
        domainCents: domainFee,
        dueDate: new Date(),
        title: domainFee ? `${title} + registro de domínio` : title,
        maxInstallments: s.annual_max_installments,
      });
      return inv.payUrl!;
    }
    const pre = await createPreapproval({ externalReference: sub.code, reason: title, amountCents: planCents, payerEmail: sub.customerEmail, backUrl: thankYou(sub.code) });
    if (!pre.init_point) throw new Error("Mercado Pago não devolveu o link da assinatura");
    await prisma.subscription.update({ where: { id: sub.id }, data: { mpPreapprovalId: pre.id, mpSubscriptionStatus: pre.status, mpInitPoint: pre.init_point } });
    return pre.init_point;
  } catch (err) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: "CANCELED", endedReason: "not_paid", endedAt: new Date(), notes: `Falha ao criar pagamento: ${String(err).slice(0, 400)}` },
    });
    throw err;
  }
}

/** Cobrança de pagamento único (1º anual, renovação anual ou taxa de domínio) com link do Mercado Pago. */
async function createPaymentInvoice(
  sub: Subscription,
  o: { kind: "PLAN" | "DOMAIN"; amountCents: number; domainCents?: number; dueDate: Date; title: string; maxInstallments: number; expiresAt?: Date },
): Promise<Invoice> {
  const reference = `${sub.code}.${randomBytes(4).toString("hex")}`;
  const inv = await prisma.invoice.create({
    data: { subscriptionId: sub.id, kind: o.kind, amountCents: o.amountCents, domainCents: o.domainCents ?? 0, dueDate: o.dueDate, reference },
  });
  const pref = await createPreference({
    externalReference: reference,
    title: o.title,
    amountCents: o.amountCents,
    payerEmail: sub.customerEmail,
    payerName: sub.customerName,
    maxInstallments: o.maxInstallments,
    backUrl: thankYou(sub.code),
    expiresAt: o.expiresAt,
  });
  return prisma.invoice.update({ where: { id: inv.id }, data: { mpPreferenceId: pref.id, payUrl: pref.init_point } });
}

// ───────── Conferência com o Mercado Pago ─────────

/** Assinatura a partir do external_reference de um pagamento (código da assinatura ou da fatura). */
export async function findByReference(ref: string | null | undefined): Promise<Subscription | null> {
  if (!ref) return null;
  if (/^BS-[A-Z0-9]{6}$/.test(ref)) return prisma.subscription.findUnique({ where: { code: ref } });
  if (/^BS-[A-Z0-9]{6}\.[a-f0-9]{8}$/.test(ref)) {
    const inv = await prisma.invoice.findUnique({ where: { reference: ref }, include: { subscription: true } });
    return inv?.subscription ?? null;
  }
  return null;
}

export async function findByCode(code: string): Promise<Subscription | null> {
  if (!/^BS-[A-Z0-9]{6}$/.test(code)) return null;
  return prisma.subscription.findUnique({ where: { code } });
}

function approvedCovering(payments: MpPayment[], cents: number): MpPayment | undefined {
  return payments.find((p) => p.status === "approved" && Math.round(Number(p.transaction_amount) * 100) >= cents);
}

/**
 * Consulta o Mercado Pago e atualiza a assinatura e as faturas. Seguro para chamar várias vezes
 * (aviso repetido, página de obrigado, botão do painel, rotina): cada efeito acontece uma vez só.
 */
export async function reconcile(sub: Subscription): Promise<Subscription> {
  if (sub.mpPreapprovalId) await reconcileMonthly(sub);
  const open = await prisma.invoice.findMany({ where: { subscriptionId: sub.id, reference: { not: null }, status: { in: ["PENDING", "FAILED", "CANCELED"] } } });
  for (const inv of open) {
    const ok = approvedCovering(await searchPayments(inv.reference!), inv.amountCents);
    if (ok) await onInvoicePaid(inv, String(ok.id), ok.date_approved ? new Date(ok.date_approved) : new Date());
  }
  return prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
}

/** Pagamento único confirmado: ativa, renova ou registra a taxa de domínio. */
async function onInvoicePaid(inv: Invoice, mpPaymentId: string, paidAt: Date): Promise<void> {
  const { count } = await prisma.invoice.updateMany({
    where: { id: inv.id, status: { notIn: ["PAID", "REFUNDED"] } },
    data: { status: "PAID", paidAt, mpPaymentId },
  });
  if (count !== 1) return;
  const sub = await prisma.subscription.findUniqueOrThrow({ where: { id: inv.subscriptionId } });
  const name = await planName(sub.plan);

  if (sub.status === "CANCELED") {
    await event(sub.id, "paid_after_cancel", inv.amountCents);
    await notifyOwner(`Pagamento recebido de assinatura cancelada: ${sub.storeName}`, `Valor: ${money(inv.amountCents)}. Confira e, se for o caso, estorne no Mercado Pago.\n\n${subscriptionSummary(sub, name)}`);
    return;
  }

  if (inv.kind === "DOMAIN" || inv.domainCents > 0) {
    await prisma.subscription.update({ where: { id: sub.id }, data: { domainPaidAt: paidAt } });
    sub.domainPaidAt = paidAt;
    if (inv.kind === "DOMAIN") {
      await event(sub.id, "domain_paid", inv.amountCents);
      await notifyOwner(`Taxa de domínio paga: ${sub.domain}`, subscriptionSummary(sub, name));
      return;
    }
  }

  // Plano anual: pago antes do vencimento estende a partir do fim do período; em atraso, a partir de agora
  const first = !sub.paidAt;
  const start = sub.currentPeriodEnd && sub.currentPeriodEnd > paidAt && sub.status === "ACTIVE" ? sub.currentPeriodEnd : paidAt;
  const end = addMonths(start, 12);
  const wasLate = sub.status === "PAST_DUE" || sub.status === "EXPIRED";
  const updated = await prisma.subscription.update({
    where: { id: sub.id },
    data: { status: "ACTIVE", paidAt: sub.paidAt ?? paidAt, mpPaymentId: sub.mpPaymentId ?? mpPaymentId, currentPeriodStart: start, currentPeriodEnd: end, graceUntil: null, endedAt: null, endedReason: null },
  });
  await prisma.invoice.update({ where: { id: inv.id }, data: { periodStart: start, periodEnd: end } });
  await event(sub.id, first ? "paid" : "renewed", inv.amountCents);
  if (first) await afterFirstPayment(updated, name);
  else await afterRenewal(updated, name, inv.amountCents, wasLate);
}

async function afterFirstPayment(sub: Subscription, name: string) {
  try {
    if (await notifyNewPaid(sub, name)) await prisma.subscription.update({ where: { id: sub.id }, data: { notifiedAt: new Date() } });
  } catch (err) {
    console.error("[billing] aviso de nova assinatura falhou:", err);
  }
}

async function afterRenewal(sub: Subscription, name: string, amountCents: number, wasLate: boolean) {
  await emailCustomer(sub.customerEmail, wasLate ? "Pagamento regularizado" : "Renovação confirmada", [
    wasLate ? "Pagamento regularizado!" : "Renovação confirmada!",
    `Recebemos ${money(amountCents)} da assinatura ${name} da loja ${sub.storeName}. Ela vale até ${dateBR(sub.currentPeriodEnd)}.`,
  ], { label: "Ver minha assinatura", url: "/conta" });
  if (wasLate) await notifyOwner(`Pagamento regularizado: ${sub.storeName}`, `Recebido ${money(amountCents)}. A assinatura voltou a ficar ativa — reative a loja se ela foi suspensa.\n\n${subscriptionSummary(sub, name)}`);
}

/** Assinatura mensal: lê as cobranças no Mercado Pago e aplica pagamentos, falhas e cancelamentos. */
async function reconcileMonthly(sub: Subscription): Promise<void> {
  const pre = await getPreapproval(sub.mpPreapprovalId!);
  if (pre.status !== sub.mpSubscriptionStatus) {
    await prisma.subscription.update({ where: { id: sub.id }, data: { mpSubscriptionStatus: pre.status } });
    sub.mpSubscriptionStatus = pre.status;
  }

  let charges: Awaited<ReturnType<typeof searchAuthorizedPayments>> | null = null;
  try {
    charges = await searchAuthorizedPayments(pre.id);
  } catch (err) {
    console.warn("[billing] busca de cobranças mensais falhou, usando o resumo da assinatura:", String(err).slice(0, 200));
  }

  if (charges) {
    let lastApproved = 0;
    for (const ap of [...charges].reverse()) {
      const pay = ap.payment;
      if (!pay?.id) continue;
      const when = new Date(ap.debit_date || ap.date_created || Date.now());
      const status = pay.status === "approved" ? "PAID" : pay.status === "rejected" || pay.status === "cancelled" ? "FAILED" : "PENDING";
      const amountCents = Math.round(Number(ap.transaction_amount ?? sub.planPriceCents / 100) * 100);
      const existing = await prisma.invoice.findUnique({ where: { mpPaymentId: String(pay.id) } });
      if (!existing) {
        await prisma.invoice.create({
          data: { subscriptionId: sub.id, kind: "PLAN", amountCents, status, dueDate: when, paidAt: status === "PAID" ? when : null, mpPaymentId: String(pay.id), failureReason: status === "FAILED" ? (pay.status_detail ?? null) : null },
        });
        if (status === "PAID") await onMonthlyCharge(sub, when, amountCents);
      } else if (existing.status !== "PAID" && existing.status !== "REFUNDED" && status === "PAID") {
        await prisma.invoice.update({ where: { id: existing.id }, data: { status: "PAID", paidAt: when, failureReason: null } });
        await onMonthlyCharge(sub, when, amountCents);
      } else if (existing.status === "PENDING" && status === "FAILED") {
        await prisma.invoice.update({ where: { id: existing.id }, data: { status: "FAILED", failureReason: pay.status_detail ?? null } });
      }
      if (status === "PAID") lastApproved = Math.max(lastApproved, when.getTime());
    }
    const latest = charges[0];
    const failed = latest && (latest.payment?.status === "rejected" || latest.status === "recycling");
    if (failed && new Date(latest.debit_date || latest.date_created || 0).getTime() > lastApproved) {
      await markPastDue(sub, "A cobrança mensal no cartão foi recusada.");
    }
  } else if ((pre.summarized?.charged_quantity ?? 0) >= 1 && !sub.paidAt) {
    await onMonthlyCharge(sub, new Date(), sub.planPriceCents);
  }

  // Cancelada fora do site (no app do Mercado Pago, ou pelo próprio MP depois de várias recusas)
  if (pre.status === "cancelled" && LIVE.includes(sub.status) && !sub.cancelAtPeriodEnd) {
    if (sub.status === "PENDING") await endSubscription(sub, "CANCELED", "not_paid");
    else if (sub.status === "PAST_DUE") await expire(sub);
    else {
      await prisma.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: true, canceledAt: new Date(), cancelReason: "Cancelada no Mercado Pago" } });
      sub.cancelAtPeriodEnd = true;
      await event(sub.id, "cancel_requested", 0, "Cancelada no Mercado Pago");
      await notifyOwner(`Assinatura cancelada no Mercado Pago: ${sub.storeName}`, `Acesso até ${dateBR(sub.currentPeriodEnd)}.\n\n${subscriptionSummary(sub, await planName(sub.plan))}`);
    }
  }
}

async function onMonthlyCharge(sub: Subscription, paidAt: Date, amountCents: number) {
  const first = !sub.paidAt;
  const wasLate = sub.status === "PAST_DUE" || sub.status === "EXPIRED";
  if (sub.status === "CANCELED") {
    await event(sub.id, "paid_after_cancel", amountCents);
    return;
  }
  const end = addMonths(paidAt, 1);
  const updated = await prisma.subscription.update({
    where: { id: sub.id },
    data: { status: "ACTIVE", paidAt: sub.paidAt ?? paidAt, currentPeriodStart: paidAt, currentPeriodEnd: end, graceUntil: null, endedAt: null, endedReason: null },
  });
  Object.assign(sub, updated);
  await event(sub.id, first ? "paid" : "renewed", amountCents);
  const name = await planName(sub.plan);
  if (first) await afterFirstPayment(updated, name);
  else if (wasLate) await afterRenewal(updated, name, amountCents, true);
}

// ───────── Inadimplência e encerramento ─────────

async function markPastDue(sub: Subscription, reason: string): Promise<void> {
  if (sub.status !== "ACTIVE") return;
  const s = await getSettings();
  const graceUntil = addDays(new Date(), s.grace_days);
  const updated = await prisma.subscription.update({ where: { id: sub.id }, data: { status: "PAST_DUE", graceUntil } });
  Object.assign(sub, updated);
  await event(sub.id, "past_due", 0, reason);
  const name = await planName(sub.plan);
  await emailCustomer(sub.customerEmail, "Não confirmamos o pagamento da sua assinatura", [
    "Não confirmamos o pagamento da sua assinatura",
    `${reason} Sua loja ${sub.storeName} continua funcionando até ${dateBR(graceUntil)}.`,
    sub.cycle === "MENSAL"
      ? "O Mercado Pago vai tentar a cobrança de novo. Confira se o cartão tem limite ou atualize-o na sua conta do Mercado Pago."
      : "Para manter a loja no ar, pague a renovação pelo link na sua área de cliente.",
    "Sem pagamento até essa data, a assinatura é encerrada, sem multa e sem juros.",
  ], { label: "Ver minha assinatura", url: "/conta" });
  await notifyOwner(`Cliente inadimplente: ${sub.storeName}`, `${reason}\nTolerância até ${dateBR(graceUntil)}.\n\n${subscriptionSummary(sub, name)}`);
}

async function stopCharging(sub: Subscription): Promise<void> {
  if (sub.mpPreapprovalId && sub.mpSubscriptionStatus !== "cancelled") {
    await cancelPreapproval(sub.mpPreapprovalId);
    await prisma.subscription.update({ where: { id: sub.id }, data: { mpSubscriptionStatus: "cancelled" } });
    sub.mpSubscriptionStatus = "cancelled";
  }
  await prisma.invoice.updateMany({ where: { subscriptionId: sub.id, status: { in: ["PENDING", "FAILED"] } }, data: { status: "CANCELED" } });
}

async function endSubscription(sub: Subscription, status: "CANCELED" | "EXPIRED", reason: string): Promise<void> {
  try {
    await stopCharging(sub);
  } catch (err) {
    console.error("[billing] não foi possível cancelar no Mercado Pago:", err);
  }
  const updated = await prisma.subscription.update({
    where: { id: sub.id },
    data: { status, endedAt: new Date(), endedReason: reason, graceUntil: null, cancelAtPeriodEnd: false, ...(status === "CANCELED" && sub.paidAt ? { stage: "CANCELADO" } : {}) },
  });
  Object.assign(sub, updated);
  await event(sub.id, status === "EXPIRED" ? "expired" : "canceled", 0, reason);
}

/** Fim da tolerância sem pagamento. */
async function expire(sub: Subscription): Promise<void> {
  await endSubscription(sub, "EXPIRED", "payment_failed");
  const name = await planName(sub.plan);
  await emailCustomer(sub.customerEmail, "Assinatura encerrada", [
    "Sua assinatura foi encerrada",
    `Não confirmamos o pagamento da assinatura ${name} da loja ${sub.storeName} dentro do prazo. Nada mais será cobrado: sem multa e sem juros.`,
    "Quer voltar? Fale com a gente ou assine de novo pelo site.",
  ], { label: "Ver planos", url: "/planos" });
  await notifyOwner(`Assinatura encerrada por falta de pagamento: ${sub.storeName}`, `Suspenda a loja do cliente.\n\n${subscriptionSummary(sub, name)}`);
}

// ───────── Ações do cliente ─────────

async function ownedSubscription(subId: string, userId: string | null): Promise<Subscription> {
  const sub = await prisma.subscription.findUnique({ where: { id: subId } });
  if (!sub || (userId && sub.userId !== userId)) throw new BillingError("Assinatura não encontrada.");
  return sub;
}

/** Faturas pagas que ainda podem ser reembolsadas pelo direito de arrependimento. */
export async function refundableInvoices(sub: Subscription): Promise<Invoice[]> {
  const s = await getSettings();
  if (sub.status !== "ACTIVE" || !sub.paidAt || sub.paidAt < addDays(new Date(), -s.refund_days)) return [];
  return prisma.invoice.findMany({ where: { subscriptionId: sub.id, status: "PAID", mpPaymentId: { not: null } } });
}

/**
 * Cancelar. `userId` null = feito pelo administrador.
 *  - refund: dentro do prazo de arrependimento, estorna tudo e encerra na hora.
 *  - aguardando 1º pagamento ou em atraso: encerra na hora, sem cobrar nada.
 *  - ativa: acesso até o fim do período, sem novas cobranças (pode desfazer).
 */
export async function cancelSubscription(subId: string, userId: string | null, opts: { refund?: boolean; reason?: string } = {}): Promise<string> {
  const sub = await ownedSubscription(subId, userId);
  if (!LIVE.includes(sub.status)) throw new BillingError("Esta assinatura não está ativa.");
  if (sub.cancelAtPeriodEnd && !opts.refund) throw new BillingError("O cancelamento já foi pedido.");
  const reason = opts.reason?.slice(0, 255) || null;
  const name = await planName(sub.plan);
  const s = await getSettings();

  if (opts.refund) {
    const invs = await refundableInvoices(sub);
    if (!invs.length) throw new BillingError(`O reembolso integral vale até ${s.refund_days} dias após o primeiro pagamento.`);
    for (const inv of invs) {
      await refundPayment(inv.mpPaymentId!, inv.id);
      await prisma.invoice.update({ where: { id: inv.id }, data: { status: "REFUNDED" } });
    }
    const total = invs.reduce((a, i) => a + i.amountCents, 0);
    await prisma.subscription.update({ where: { id: sub.id }, data: { canceledAt: new Date(), cancelReason: reason } });
    await endSubscription(sub, "CANCELED", "refunded");
    await event(sub.id, "refunded", -total, reason ?? undefined);
    await emailCustomer(sub.customerEmail, "Assinatura cancelada com reembolso", [
      "Assinatura cancelada com reembolso",
      `Cancelamos a assinatura ${name} da loja ${sub.storeName} e estornamos ${money(total)} (direito de arrependimento).`,
      "No cartão, o estorno pode levar até 2 faturas para aparecer; no Pix, volta para a conta de origem.",
    ]);
    await notifyOwner(`Cancelamento com reembolso: ${sub.storeName}`, `Estornado: ${money(total)}${reason ? `\nMotivo: ${reason}` : ""}\n${userId ? "Pedido pelo cliente." : "Feito pelo admin."}\n\n${subscriptionSummary(sub, name)}`);
    return `Assinatura cancelada e ${money(total)} estornados.`;
  }

  if (sub.status === "PENDING" || sub.status === "PAST_DUE") {
    await prisma.subscription.update({ where: { id: sub.id }, data: { canceledAt: new Date(), cancelReason: reason } });
    await endSubscription(sub, "CANCELED", "canceled");
    await emailCustomer(sub.customerEmail, "Assinatura cancelada", ["Assinatura cancelada", `Cancelamos a assinatura da loja ${sub.storeName}. Nenhuma cobrança em aberto será feita.`]);
    if (sub.paidAt) await notifyOwner(`Assinatura cancelada: ${sub.storeName}`, `Encerrada na hora (estava ${sub.status === "PAST_DUE" ? "em atraso" : "aguardando pagamento"}). Suspenda a loja.${reason ? `\nMotivo: ${reason}` : ""}\n\n${subscriptionSummary(sub, name)}`);
    return "Assinatura cancelada. Nada será cobrado.";
  }

  await stopCharging(sub);
  await prisma.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: true, canceledAt: new Date(), cancelReason: reason } });
  await event(sub.id, "cancel_requested", 0, reason ?? undefined);
  await emailCustomer(sub.customerEmail, "Cancelamento confirmado", [
    "Cancelamento confirmado",
    `Sua loja ${sub.storeName} continua no ar até ${dateBR(sub.currentPeriodEnd)}. Nenhuma nova cobrança será feita.`,
    "Mudou de ideia? Dá para desfazer o cancelamento na sua área de cliente até essa data.",
  ], { label: "Ver minha assinatura", url: "/conta" });
  await notifyOwner(`Cancelamento agendado: ${sub.storeName}`, `A loja fica no ar até ${dateBR(sub.currentPeriodEnd)}.${reason ? `\nMotivo: ${reason}` : ""}\n\n${subscriptionSummary(sub, name)}`);
  return `Cancelado: sua loja continua no ar até ${dateBR(sub.currentPeriodEnd)} e nada mais será cobrado.`;
}

/** Desfazer o cancelamento antes do fim do período. No mensal, o cliente autoriza o cartão de novo. */
export async function undoCancel(subId: string, userId: string): Promise<{ message: string; redirect?: string }> {
  const sub = await ownedSubscription(subId, userId);
  if (sub.status !== "ACTIVE" || !sub.cancelAtPeriodEnd) throw new BillingError("Não há cancelamento para desfazer.");
  if (!sub.currentPeriodEnd || sub.currentPeriodEnd <= new Date()) throw new BillingError("O período já terminou: assine de novo.");
  let redirect: string | undefined;
  if (sub.cycle === "MENSAL") {
    const pre = await createPreapproval({
      externalReference: sub.code,
      reason: `VirtualStore ${await planName(sub.plan)} · mensal`,
      amountCents: sub.planPriceCents,
      payerEmail: sub.customerEmail,
      backUrl: `${siteUrl()}/conta`,
      startDate: sub.currentPeriodEnd,
      idempotencyKey: `sub-${sub.code}-${Date.now()}`,
    });
    await prisma.subscription.update({ where: { id: sub.id }, data: { mpPreapprovalId: pre.id, mpSubscriptionStatus: pre.status, mpInitPoint: pre.init_point ?? null } });
    redirect = pre.init_point;
  }
  await prisma.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: false, canceledAt: null, cancelReason: null } });
  await event(sub.id, "cancel_undone");
  await notifyOwner(`Cancelamento desfeito: ${sub.storeName}`, subscriptionSummary(sub, await planName(sub.plan)));
  return { message: sub.cycle === "MENSAL" ? "Autorize o cartão no Mercado Pago para continuar a assinatura." : "Cancelamento desfeito: sua assinatura continua.", redirect };
}

/** Link para pagar o que está em aberto: 1º pagamento, renovação anual ou taxa de domínio. */
export async function payUrlFor(subId: string, userId: string, what: "open" | "domain"): Promise<string> {
  const sub = await ownedSubscription(subId, userId);
  const s = await getSettings();
  if (what === "domain") {
    if (sub.domainOption !== "REGISTER" || sub.domainPaidAt || !["ACTIVE", "PAST_DUE"].includes(sub.status)) throw new BillingError("Não há taxa de domínio a pagar.");
    const open = await prisma.invoice.findFirst({ where: { subscriptionId: sub.id, kind: "DOMAIN", status: "PENDING" } });
    if (open?.payUrl) return open.payUrl;
    const inv = await createPaymentInvoice(sub, { kind: "DOMAIN", amountCents: sub.domainFeeCents, dueDate: new Date(), title: `Registro do domínio ${sub.domain} (1 ano)`, maxInstallments: 1 });
    return inv.payUrl!;
  }
  if (sub.status === "PENDING" && sub.cycle === "MENSAL" && sub.mpInitPoint) return sub.mpInitPoint;
  const open = await prisma.invoice.findFirst({ where: { subscriptionId: sub.id, kind: "PLAN", status: "PENDING", payUrl: { not: null } }, orderBy: { createdAt: "desc" } });
  if (open?.payUrl) return open.payUrl;
  if (sub.cycle === "ANUAL" && sub.status === "PAST_DUE") return (await ensureRenewalInvoice(sub, s.annual_max_installments)).payUrl!;
  throw new BillingError("Não há pagamento em aberto.");
}

async function ensureRenewalInvoice(sub: Subscription, maxInstallments: number): Promise<Invoice> {
  const open = await prisma.invoice.findFirst({ where: { subscriptionId: sub.id, kind: "PLAN", status: "PENDING", createdAt: { gte: sub.currentPeriodStart ?? sub.createdAt } } });
  if (open) return open;
  const s = await getSettings();
  const due = sub.currentPeriodEnd ?? new Date();
  return createPaymentInvoice(sub, {
    kind: "PLAN",
    amountCents: sub.planPriceCents,
    dueDate: due,
    title: `Renovação VirtualStore ${await planName(sub.plan)} · anual`,
    maxInstallments,
    expiresAt: addDays(due, s.grace_days + 1),
  });
}

// ───────── Rotina diária ─────────

/**
 * Renovação do anual, fim de período, tolerância e pedidos não pagos.
 * Chamada pelo cron (/api/cron/billing) e, no máximo a cada 10 min, ao abrir o painel.
 */
export async function runBillingJobs(now = new Date()): Promise<Record<string, number>> {
  const s = await getSettings();
  const count: Record<string, number> = { checked: 0, renewals: 0, pastDue: 0, expired: 0, ended: 0, discarded: 0, errors: 0 };
  const subs = await prisma.subscription.findMany({ where: { status: { in: LIVE } } });

  for (let sub of subs) {
    count.checked++;
    try {
      if (sub.status === "PENDING") {
        if (sub.createdAt < addDays(now, -s.pending_expire_days)) {
          if (sub.mpPreapprovalId || (await prisma.invoice.count({ where: { subscriptionId: sub.id, reference: { not: null } } }))) sub = await reconcile(sub);
          if (sub.status === "PENDING") {
            await endSubscription(sub, "CANCELED", "not_paid");
            count.discarded++;
          }
        }
        continue;
      }

      if (sub.status === "ACTIVE" && sub.currentPeriodEnd) {
        const end = sub.currentPeriodEnd;
        if (now >= end) {
          if (sub.cancelAtPeriodEnd) {
            await endSubscription(sub, "CANCELED", "canceled");
            await notifyOwner(`Assinatura encerrada: ${sub.storeName}`, `Fim do período após cancelamento. Suspenda a loja.\n\n${subscriptionSummary(sub, await planName(sub.plan))}`);
            await emailCustomer(sub.customerEmail, "Sua assinatura terminou", ["Sua assinatura terminou", `A assinatura da loja ${sub.storeName} chegou ao fim, como você pediu. Obrigado por ter estado com a gente!`], { label: "Ver planos", url: "/planos" });
            count.ended++;
            continue;
          }
          sub = await reconcile(sub);
          if (sub.status === "ACTIVE" && sub.currentPeriodEnd && now >= sub.currentPeriodEnd) {
            // Mensal: o Mercado Pago pode debitar com até 2 dias de atraso
            if (sub.cycle === "ANUAL" || now >= addDays(sub.currentPeriodEnd, 2)) {
              if (sub.cycle === "ANUAL") await ensureRenewalInvoice(sub, s.annual_max_installments);
              await markPastDue(sub, sub.cycle === "ANUAL" ? "A renovação anual não foi paga." : "A cobrança mensal não foi confirmada.");
              count.pastDue++;
            }
          }
          continue;
        }
        // Anual: link da renovação alguns dias antes, com lembrete a 3 dias
        if (sub.cycle === "ANUAL" && !sub.cancelAtPeriodEnd && end.getTime() - now.getTime() <= s.renewal_notice_days * DAY) {
          const inv = await ensureRenewalInvoice(sub, s.annual_max_installments);
          const key = `renew:${end.toISOString().slice(0, 10)}`;
          const soon = end.getTime() - now.getTime() <= 3 * DAY;
          if ((await addReminder(sub, key)) || (soon && (await addReminder(sub, `${key}:3d`)))) {
            await emailCustomer(sub.customerEmail, soon ? "Sua assinatura vence em poucos dias" : "Renovação da sua assinatura", [
              soon ? "Sua assinatura vence em poucos dias" : "Hora de renovar sua assinatura",
              `A assinatura anual da loja ${sub.storeName} vence em ${dateBR(end)}. Renove por ${money(inv.amountCents)} no Pix ou em até ${s.annual_max_installments}x no cartão.`,
              "Não quer renovar? Você pode cancelar na sua área de cliente; nada será cobrado.",
            ], { label: "Pagar renovação", url: inv.payUrl ?? "/conta" });
            count.renewals++;
          }
        }
        continue;
      }

      if (sub.status === "PAST_DUE") {
        sub = await reconcile(sub);
        if (sub.status !== "PAST_DUE") continue;
        if (sub.graceUntil && now >= sub.graceUntil) {
          await expire(sub);
          count.expired++;
        } else if (sub.graceUntil && sub.graceUntil.getTime() - now.getTime() <= DAY && (await addReminder(sub, `due_last:${sub.graceUntil.toISOString().slice(0, 10)}`))) {
          await emailCustomer(sub.customerEmail, "Último dia para regularizar sua assinatura", [
            "Último dia para regularizar sua assinatura",
            `Sem o pagamento até ${dateBR(sub.graceUntil)}, a assinatura da loja ${sub.storeName} é encerrada (sem multa e sem juros).`,
          ], { label: "Regularizar", url: "/conta" });
        }
      }
    } catch (err) {
      count.errors++;
      console.error("[billing] rotina falhou para", sub.code, err);
    }
  }
  return count;
}

let lastRun = 0;
/** Roda a rotina no máximo a cada 10 minutos (ao abrir o painel), sem travar a página se falhar. */
export async function runBillingJobsThrottled(): Promise<void> {
  if (Date.now() - lastRun < 10 * 60e3) return;
  lastRun = Date.now();
  await runBillingJobs().catch((err) => console.error("[billing] rotina:", err));
}
