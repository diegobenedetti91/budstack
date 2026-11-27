import "server-only";
import { randomBytes } from "crypto";
import type { Invoice, Subscription } from "@prisma/client";
import { prisma } from "./prisma";
import { getSettings } from "./settings";
import { getPlan, planNames, planPriceCents, type Cycle, type PlanView } from "./plans";
import {
  cancelPreapproval,
  createPreapproval,
  createPreference,
  getPreapproval,
  refundPayment as mpRefundPayment,
  searchAuthorizedPayments,
  searchPayments,
  setPreapprovalAmount,
  setPreapprovalStatus,
  siteUrl,
  type MpPayment,
} from "./mercadopago";
import * as asaas from "./asaas";
import { emailCustomer, notifyNewPaid, notifyOwner, subscriptionSummary } from "./notify";
import { money } from "./format";

/**
 * Regras de assinatura (padrão de mercado + Código de Defesa do Consumidor):
 *  - Gateway escolhido no painel (vale para novas assinaturas; cada assinatura fica no gateway em que nasceu):
 *    · Mercado Pago: mensal no cartão (assinatura); anual em pagamento único (Pix ou cartão parcelado), com o
 *      link da renovação enviado alguns dias antes do vencimento.
 *    · Asaas: assinatura recorrente mensal ou anual; o cliente escolhe Pix, boleto ou cartão na fatura e o
 *      próprio Asaas gera as renovações. Taxa de domínio em cobrança avulsa.
 *    · Simulado: tudo dentro do site, sem dinheiro real (só com ALLOW_SIMULATED_PAYMENTS=1), para testes.
 *  - Cancelar quando quiser, sem multa: o acesso segue até o fim do período pago e nada mais é cobrado.
 *    Dá para desfazer antes do fim do período.
 *  - Arrependimento (CDC art. 49): até N dias (padrão 7) do 1º pagamento, cancelamento com reembolso integral.
 *  - Pausa ("congelar"): de 1 a N meses (padrão 3), começando no fim do período pago; sem cobrança na pausa;
 *    volta sozinha (ou antes, se o cliente quiser). Uma pausa a cada N meses (padrão 6). Só ativa e em dia.
 *  - Troca de plano: vale a partir da próxima renovação, sem cobrança dupla.
 *  - Pagamento não confirmado: assinatura "em atraso" com tolerância de N dias (padrão 7) e avisos ao cliente.
 *    Sem pagamento, é encerrada sem multa e você é avisado para suspender a loja.
 *  - O preço de cada assinatura fica congelado: mudar o preço do plano não afeta quem já assinou.
 */

export class BillingError extends Error {}

const DAY = 864e5;
const LIVE = ["PENDING", "ACTIVE", "PAUSED", "PAST_DUE"];

export type Provider = "MERCADOPAGO" | "ASAAS" | "SIMULADO";
export const PROVIDER_LABEL: Record<string, string> = { MERCADOPAGO: "Mercado Pago", ASAAS: "Asaas", SIMULADO: "Simulado (teste)" };

/** Gateway das novas assinaturas (configurações do painel). */
export async function activeProvider(): Promise<Provider> {
  const p = (await getSettings()).payment_provider;
  if (p === "SIMULADO") {
    if (process.env.ALLOW_SIMULATED_PAYMENTS !== "1") throw new BillingError("O pagamento está em modo de teste, que foi desligado. Fale com a BudStack.");
    return "SIMULADO";
  }
  return p === "ASAAS" ? "ASAAS" : "MERCADOPAGO";
}

/** Renovação feita pelo próprio site (link de pagamento): Mercado Pago anual e Simulado. Nos outros, o gateway cobra sozinho. */
export const usesOwnRenewal = (s: Pick<Subscription, "provider" | "cycle">) => s.provider === "SIMULADO" || (s.provider === "MERCADOPAGO" && s.cycle === "ANUAL");
const cycleMonths = (c: string) => (c === "ANUAL" ? 12 : 1);

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

/** Cria a assinatura e o pagamento no gateway ativo. Retorna o link para onde o cliente vai pagar. */
export async function startSubscription(input: StartInput): Promise<string> {
  const s = await getSettings();
  const provider = await activeProvider();
  const planCents = planPriceCents(input.plan, input.cycle, s);
  const domainFee = input.domainOption === "REGISTER" ? s.domain_fee_cents : 0;
  // Taxa de domínio no 1º pagamento: só quando ele é uma cobrança única (anual no MP ou no simulado)
  const domainInFirst = input.cycle === "ANUAL" && provider !== "ASAAS";
  const total = domainInFirst ? planCents + domainFee : planCents;

  const sub = await prisma.subscription.create({
    data: {
      code: newCode(),
      provider,
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
    if (provider === "ASAAS") {
      const customer = await ensureAsaasCustomer(sub);
      const created = await asaas.createSubscription({ customer, valueCents: planCents, cycle: input.cycle === "ANUAL" ? "YEARLY" : "MONTHLY", nextDueDate: asaas.asaasDate(), description: title, externalReference: sub.code });
      await prisma.subscription.update({ where: { id: sub.id }, data: { asaasSubscriptionId: created.id, mpSubscriptionStatus: created.status ?? "ACTIVE" } });
      const first = (await asaas.listSubscriptionPayments(created.id))[0];
      if (!first?.invoiceUrl) throw new Error("O Asaas não devolveu a fatura da assinatura");
      await prisma.invoice.create({ data: { subscriptionId: sub.id, kind: "PLAN", amountCents: Math.round(first.value * 100), dueDate: new Date(`${first.dueDate}T12:00:00-03:00`), asaasPaymentId: first.id, payUrl: first.invoiceUrl } });
      return first.invoiceUrl;
    }
    if (input.cycle === "ANUAL" || provider === "SIMULADO") {
      const inv = await createPaymentInvoice(sub, {
        kind: "PLAN",
        amountCents: total,
        domainCents: domainInFirst ? domainFee : 0,
        dueDate: new Date(),
        title: domainInFirst && domainFee ? `${title} + registro de domínio` : title,
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

/** Cliente no Asaas (criado uma vez por usuário e reaproveitado). */
async function ensureAsaasCustomer(sub: Subscription): Promise<string> {
  const user = sub.userId ? await prisma.user.findUnique({ where: { id: sub.userId } }) : null;
  if (user?.asaasCustomerId) return user.asaasCustomerId;
  const id = await asaas.createCustomer({ name: sub.customerName, email: sub.customerEmail, cpfCnpj: sub.customerDocument, phone: sub.customerPhone, externalReference: sub.userId ?? sub.code });
  if (user) await prisma.user.update({ where: { id: user.id }, data: { asaasCustomerId: id } });
  return id;
}

/** Cobrança de pagamento único (1º anual, renovação, taxa de domínio) com o link do gateway da assinatura. */
async function createPaymentInvoice(
  sub: Subscription,
  o: { kind: "PLAN" | "DOMAIN"; amountCents: number; domainCents?: number; dueDate: Date; title: string; maxInstallments: number; expiresAt?: Date },
): Promise<Invoice> {
  const reference = `${sub.code}.${randomBytes(4).toString("hex")}`;
  const inv = await prisma.invoice.create({
    data: { subscriptionId: sub.id, kind: o.kind, amountCents: o.amountCents, domainCents: o.domainCents ?? 0, dueDate: o.dueDate, reference },
  });
  if (sub.provider === "SIMULADO") {
    return prisma.invoice.update({ where: { id: inv.id }, data: { payUrl: `${siteUrl()}/conta/pagar/${inv.id}` } });
  }
  if (sub.provider === "ASAAS") {
    const customer = await ensureAsaasCustomer(sub);
    const due = o.dueDate > new Date() ? o.dueDate : new Date();
    const p = await asaas.createPayment({ customer, valueCents: o.amountCents, dueDate: asaas.asaasDate(due), description: o.title, externalReference: reference });
    return prisma.invoice.update({ where: { id: inv.id }, data: { asaasPaymentId: p.id, payUrl: p.invoiceUrl ?? null } });
  }
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
  if (sub.provider === "ASAAS") {
    await reconcileAsaas(sub);
  } else if (sub.provider === "MERCADOPAGO") {
    if (sub.mpPreapprovalId) await reconcileMonthly(sub);
    const open = await prisma.invoice.findMany({ where: { subscriptionId: sub.id, reference: { not: null }, status: { in: ["PENDING", "FAILED", "CANCELED"] } } });
    for (const inv of open) {
      const ok = approvedCovering(await searchPayments(inv.reference!), inv.amountCents);
      if (ok) await onInvoicePaid(inv, String(ok.id), ok.date_approved ? new Date(ok.date_approved) : new Date());
    }
  }
  // Simulado: nada a consultar (os pagamentos acontecem na própria página do site)
  return prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
}

/** Asaas: lê as cobranças da assinatura e as avulsas, e aplica pagamentos, atrasos, estornos e cancelamento externo. */
async function reconcileAsaas(sub: Subscription): Promise<void> {
  if (sub.asaasSubscriptionId) {
    const remote = await asaas.getSubscription(sub.asaasSubscriptionId).catch(() => null);
    const payments = await asaas.listSubscriptionPayments(sub.asaasSubscriptionId);
    let lastPaidIdx = -1; // lista já vem ordenada por vencimento
    for (const [i, p] of payments.entries()) {
      await applyAsaasPayment(sub, p);
      if (asaas.isPaid(p)) lastPaidIdx = i;
      Object.assign(sub, await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } }));
    }
    if (payments.some((p, i) => p.status === "OVERDUE" && !p.deleted && i > lastPaidIdx)) {
      await markPastDue(sub, "A cobrança venceu sem pagamento.");
    }
    // Assinatura apagada direto no painel do Asaas
    if (remote?.deleted && sub.mpSubscriptionStatus !== "DELETED") {
      await prisma.subscription.update({ where: { id: sub.id }, data: { mpSubscriptionStatus: "DELETED" } });
      sub.mpSubscriptionStatus = "DELETED";
      if (sub.status === "PENDING") await endSubscription(sub, "CANCELED", "not_paid");
      else if (sub.status === "PAST_DUE") await expire(sub);
      else if (sub.status === "PAUSED") await endSubscription(sub, "CANCELED", "canceled");
      else if (sub.status === "ACTIVE" && !sub.cancelAtPeriodEnd) {
        await prisma.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: true, canceledAt: new Date(), cancelReason: "Cancelada no Asaas" } });
        await event(sub.id, "cancel_requested", 0, "Cancelada no Asaas");
        await notifyOwner(`Assinatura cancelada no Asaas: ${sub.storeName}`, `Acesso até ${dateBR(sub.currentPeriodEnd)}.\n\n${subscriptionSummary(sub, await planName(sub.plan))}`);
      }
    }
  }
  // Cobranças avulsas (taxa de domínio, etc.) ainda não pagas
  const open = await prisma.invoice.findMany({ where: { subscriptionId: sub.id, asaasPaymentId: { not: null }, reference: { not: null }, status: { in: ["PENDING", "FAILED"] } } });
  for (const inv of open) await applyAsaasPayment(sub, await asaas.getPayment(inv.asaasPaymentId!), inv);
}

async function applyAsaasPayment(sub: Subscription, p: asaas.AsaasPayment, known?: Invoice): Promise<void> {
  let inv = known ?? (await prisma.invoice.findUnique({ where: { asaasPaymentId: p.id } }));
  if (!inv) {
    if (p.deleted) return;
    inv = await prisma.invoice.create({
      data: { subscriptionId: sub.id, kind: "PLAN", amountCents: Math.round(p.value * 100), dueDate: new Date(`${p.dueDate}T12:00:00-03:00`), asaasPaymentId: p.id, payUrl: p.invoiceUrl ?? null },
    });
  }
  if (p.invoiceUrl && p.invoiceUrl !== inv.payUrl) await prisma.invoice.update({ where: { id: inv.id }, data: { payUrl: p.invoiceUrl } });
  if (p.deleted) {
    if (inv.status === "PENDING" || inv.status === "FAILED") await prisma.invoice.update({ where: { id: inv.id }, data: { status: "CANCELED" } });
    return;
  }
  if (asaas.isPaid(p) && inv.status !== "PAID" && inv.status !== "REFUNDED") {
    await onInvoicePaid(inv, null, asaas.paidDate(p));
  } else if (asaas.isRefunded(p) && inv.status === "PAID") {
    await prisma.invoice.update({ where: { id: inv.id }, data: { status: "REFUNDED" } });
  } else if (p.status === "OVERDUE" && inv.status === "PENDING") {
    await prisma.invoice.update({ where: { id: inv.id }, data: { status: "FAILED", failureReason: "Venceu sem pagamento" } });
  }
}

/** Pagamento único confirmado: ativa, renova ou registra a taxa de domínio. */
async function onInvoicePaid(inv: Invoice, mpPaymentId: string | null, paidAt: Date): Promise<void> {
  const { count } = await prisma.invoice.updateMany({
    where: { id: inv.id, status: { notIn: ["PAID", "REFUNDED"] } },
    data: { status: "PAID", paidAt, ...(mpPaymentId ? { mpPaymentId } : {}) },
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

  // Pago antes do vencimento estende a partir do fim do período; em atraso, a partir de agora.
  // Pago durante a pausa: o novo ano começa quando a pausa termina (a assinatura segue pausada até lá).
  const first = !sub.paidAt;
  const paused = sub.status === "PAUSED" && !!sub.pauseUntil;
  const start = paused ? sub.pauseUntil! : sub.currentPeriodEnd && sub.currentPeriodEnd > paidAt && sub.status === "ACTIVE" ? sub.currentPeriodEnd : paidAt;
  const end = addMonths(start, cycleMonths(sub.cycle));
  const wasLate = sub.status === "PAST_DUE" || sub.status === "EXPIRED";
  const updated = await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      status: paused ? "PAUSED" : "ACTIVE",
      paidAt: sub.paidAt ?? paidAt,
      mpPaymentId: sub.mpPaymentId ?? mpPaymentId ?? undefined,
      currentPeriodStart: start,
      currentPeriodEnd: end,
      graceUntil: null,
      endedAt: null,
      endedReason: null,
      ...(!first ? applyNextPlan(sub) : {}),
    },
  });
  await prisma.invoice.update({ where: { id: inv.id }, data: { periodStart: start, periodEnd: end } });
  await event(sub.id, first ? "paid" : "renewed", inv.amountCents);
  const newName = await planName(updated.plan);
  if (first) await afterFirstPayment(updated, newName);
  else await afterRenewal(updated, newName, inv.amountCents, wasLate);
}

/** Troca de plano agendada: aplica na renovação. */
function applyNextPlan(sub: Subscription) {
  return sub.nextPlan && sub.nextPlanPriceCents ? { plan: sub.nextPlan, planPriceCents: sub.nextPlanPriceCents, nextPlan: null, nextPlanPriceCents: null } : {};
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
    else if (sub.status === "PAUSED") {
      await endSubscription(sub, "CANCELED", "canceled");
      await notifyOwner(`Assinatura cancelada no Mercado Pago: ${sub.storeName}`, `Estava pausada; foi encerrada.\n\n${subscriptionSummary(sub, await planName(sub.plan))}`);
    }
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
    data: { status: "ACTIVE", paidAt: sub.paidAt ?? paidAt, currentPeriodStart: paidAt, currentPeriodEnd: end, graceUntil: null, endedAt: null, endedReason: null, ...(!first ? applyNextPlan(sub) : {}) },
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
    sub.provider === "MERCADOPAGO" && sub.cycle === "MENSAL"
      ? "O Mercado Pago vai tentar a cobrança de novo. Confira se o cartão tem limite ou atualize-o na sua conta do Mercado Pago."
      : "Para manter a loja no ar, pague a cobrança pelo link na sua área de cliente.",
    "Sem pagamento até essa data, a assinatura é encerrada, sem multa e sem juros.",
  ], { label: "Ver minha assinatura", url: "/conta" });
  await notifyOwner(`Cliente inadimplente: ${sub.storeName}`, `${reason}\nTolerância até ${dateBR(graceUntil)}.\n\n${subscriptionSummary(sub, name)}`);
}

async function stopCharging(sub: Subscription): Promise<void> {
  if (sub.provider === "MERCADOPAGO" && sub.mpPreapprovalId && sub.mpSubscriptionStatus !== "cancelled") {
    await cancelPreapproval(sub.mpPreapprovalId);
    await prisma.subscription.update({ where: { id: sub.id }, data: { mpSubscriptionStatus: "cancelled" } });
    sub.mpSubscriptionStatus = "cancelled";
  }
  if (sub.provider === "ASAAS") {
    if (sub.asaasSubscriptionId && sub.mpSubscriptionStatus !== "DELETED") {
      await asaas.deleteSubscription(sub.asaasSubscriptionId);
      await prisma.subscription.update({ where: { id: sub.id }, data: { mpSubscriptionStatus: "DELETED" } });
      sub.mpSubscriptionStatus = "DELETED";
    }
    // Avulsas em aberto (ex.: taxa de domínio) deixam de ser cobradas
    const open = await prisma.invoice.findMany({ where: { subscriptionId: sub.id, asaasPaymentId: { not: null }, status: { in: ["PENDING", "FAILED"] } } });
    for (const inv of open) await asaas.deletePayment(inv.asaasPaymentId!).catch((e) => console.warn("[billing] não apagou cobrança no Asaas:", String(e).slice(0, 200)));
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
  return prisma.invoice.findMany({
    where: { subscriptionId: sub.id, status: "PAID", ...(sub.provider === "SIMULADO" ? {} : { OR: [{ mpPaymentId: { not: null } }, { asaasPaymentId: { not: null } }] }) },
  });
}

/**
 * Cancelar. `userId` null = feito pelo administrador.
 *  - refund: dentro do prazo de arrependimento, estorna tudo e encerra na hora.
 *  - aguardando 1º pagamento, em atraso ou pausada: encerra na hora, sem cobrar nada.
 *  - ativa: acesso até o fim do período, sem novas cobranças (pode desfazer). Pausa e troca de plano agendadas são desfeitas.
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
      if (inv.asaasPaymentId) await asaas.refundPayment(inv.asaasPaymentId);
      else if (inv.mpPaymentId) await mpRefundPayment(inv.mpPaymentId, inv.id);
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

  if (sub.status === "PENDING" || sub.status === "PAST_DUE" || sub.status === "PAUSED") {
    const was = sub.status === "PAST_DUE" ? "em atraso" : sub.status === "PAUSED" ? "pausada" : "aguardando pagamento";
    await prisma.subscription.update({ where: { id: sub.id }, data: { canceledAt: new Date(), cancelReason: reason, pauseFrom: null, pauseUntil: null, nextPlan: null, nextPlanPriceCents: null } });
    await endSubscription(sub, "CANCELED", "canceled");
    await emailCustomer(sub.customerEmail, "Assinatura cancelada", ["Assinatura cancelada", `Cancelamos a assinatura da loja ${sub.storeName}. Nenhuma cobrança em aberto será feita.`]);
    if (sub.paidAt) await notifyOwner(`Assinatura cancelada: ${sub.storeName}`, `Encerrada na hora (estava ${was}). Suspenda a loja.${reason ? `\nMotivo: ${reason}` : ""}\n\n${subscriptionSummary(sub, name)}`);
    return "Assinatura cancelada. Nada será cobrado.";
  }

  await stopCharging(sub);
  await prisma.subscription.update({
    where: { id: sub.id },
    data: { cancelAtPeriodEnd: true, canceledAt: new Date(), cancelReason: reason, pauseFrom: null, pauseUntil: null, lastPauseAt: sub.pauseFrom ? null : sub.lastPauseAt, nextPlan: null, nextPlanPriceCents: null },
  });
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
  if (sub.provider === "ASAAS") {
    // Nova recorrência a partir do fim do período pago (sem cobrar agora)
    const customer = await ensureAsaasCustomer(sub);
    const created = await asaas.createSubscription({
      customer,
      valueCents: sub.planPriceCents,
      cycle: sub.cycle === "ANUAL" ? "YEARLY" : "MONTHLY",
      nextDueDate: asaas.asaasDate(sub.currentPeriodEnd),
      description: `VirtualStore ${await planName(sub.plan)} · ${cycleWord(sub.cycle)}`,
      externalReference: sub.code,
    });
    await prisma.subscription.update({ where: { id: sub.id }, data: { asaasSubscriptionId: created.id, mpSubscriptionStatus: created.status ?? "ACTIVE" } });
  } else if (sub.provider === "MERCADOPAGO" && sub.cycle === "MENSAL") {
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
  return { message: redirect ? "Autorize o cartão no Mercado Pago para continuar a assinatura." : "Cancelamento desfeito: sua assinatura continua.", redirect };
}

/** Link para pagar o que está em aberto: 1º pagamento, renovação anual ou taxa de domínio. */
export async function payUrlFor(subId: string, userId: string, what: "open" | "domain"): Promise<string> {
  const sub = await ownedSubscription(subId, userId);
  const s = await getSettings();
  if (what === "domain") {
    if (sub.domainOption !== "REGISTER" || sub.domainPaidAt || !["ACTIVE", "PAST_DUE", "PAUSED"].includes(sub.status)) throw new BillingError("Não há taxa de domínio a pagar.");
    const open = await prisma.invoice.findFirst({ where: { subscriptionId: sub.id, kind: "DOMAIN", status: "PENDING" } });
    if (open?.payUrl) return open.payUrl;
    const inv = await createPaymentInvoice(sub, { kind: "DOMAIN", amountCents: sub.domainFeeCents, dueDate: new Date(), title: `Registro do domínio ${sub.domain} (1 ano)`, maxInstallments: 1 });
    return inv.payUrl!;
  }
  if (sub.provider === "MERCADOPAGO" && sub.status === "PENDING" && sub.cycle === "MENSAL" && sub.mpInitPoint) return sub.mpInitPoint;
  // Asaas e simulado: a cobrança vencida continua pagável pelo mesmo link
  const statuses = sub.provider === "MERCADOPAGO" ? ["PENDING"] : ["PENDING", "FAILED"];
  const open = await prisma.invoice.findFirst({ where: { subscriptionId: sub.id, kind: "PLAN", status: { in: statuses }, payUrl: { not: null } }, orderBy: { createdAt: "desc" } });
  if (open?.payUrl) return open.payUrl;
  if (usesOwnRenewal(sub) && sub.status === "PAST_DUE") return (await ensureRenewalInvoice(sub, s.annual_max_installments)).payUrl!;
  throw new BillingError("Não há pagamento em aberto.");
}

async function ensureRenewalInvoice(sub: Subscription, maxInstallments: number): Promise<Invoice> {
  const open = await prisma.invoice.findFirst({ where: { subscriptionId: sub.id, kind: "PLAN", status: "PENDING", createdAt: { gte: sub.currentPeriodStart ?? sub.createdAt } } });
  if (open) return open;
  const s = await getSettings();
  const due = (sub.status === "PAUSED" ? sub.pauseUntil : sub.currentPeriodEnd) ?? new Date();
  return createPaymentInvoice(sub, {
    kind: "PLAN",
    amountCents: sub.nextPlanPriceCents ?? sub.planPriceCents,
    dueDate: due,
    title: `Renovação VirtualStore ${await planName(sub.nextPlan ?? sub.plan)} · anual`,
    maxInstallments,
    expiresAt: addDays(due, s.grace_days + 1),
  });
}

// ───────── Pagamento simulado (gateway "SIMULADO", só para testes) ─────────

/** Paga (ou recusa) uma cobrança no modo simulado. Nenhum dinheiro de verdade. */
export async function payMockInvoice(invoiceId: string, userId: string, outcome: "pix" | "card_ok" | "card_fail"): Promise<{ message: string; code: string; failed: boolean }> {
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { subscription: true } });
  if (!inv || inv.subscription.userId !== userId) throw new BillingError("Cobrança não encontrada.");
  if (inv.subscription.provider !== "SIMULADO") throw new BillingError("Esta cobrança é paga no gateway.");
  const sub = inv.subscription;
  if (inv.status === "PAID") return { message: "Esta cobrança já está paga.", code: sub.code, failed: false };
  if (inv.status !== "PENDING" && inv.status !== "FAILED") throw new BillingError("Esta cobrança não está em aberto.");
  if (outcome === "card_fail") {
    await prisma.invoice.update({ where: { id: inv.id }, data: { status: "FAILED", failureReason: "Cartão recusado (simulação)" } });
    if (sub.status === "ACTIVE") await markPastDue(sub, "O cartão foi recusado (simulação).");
    return { message: "Pagamento recusado (simulação). Tente de novo com outra forma.", code: sub.code, failed: true };
  }
  await onInvoicePaid(inv, null, new Date());
  return { message: outcome === "pix" ? "Pix aprovado (simulação)." : "Cartão aprovado (simulação).", code: sub.code, failed: false };
}

// ───────── Pausa ("congelar") e troca de plano ─────────

/** Pausar de 1 a N meses a partir do fim do período pago. Sem cobrança na pausa; volta sozinha. */
export async function pauseSubscription(subId: string, userId: string, months: number): Promise<string> {
  const sub = await ownedSubscription(subId, userId);
  const s = await getSettings();
  if (sub.status !== "ACTIVE" || !sub.currentPeriodEnd) throw new BillingError("Só dá para pausar uma assinatura ativa e em dia.");
  if (sub.cancelAtPeriodEnd) throw new BillingError("A assinatura já está cancelada.");
  if (sub.pauseFrom) throw new BillingError("Já existe uma pausa agendada.");
  if (!Number.isInteger(months) || months < 1 || months > s.pause_max_months) throw new BillingError(`Escolha de 1 a ${s.pause_max_months} ${s.pause_max_months === 1 ? "mês" : "meses"}.`);
  if (s.pause_cooldown_months > 0 && sub.lastPauseAt) {
    const next = addMonths(sub.lastPauseAt, s.pause_cooldown_months);
    if (new Date() < next) throw new BillingError(`Você pode pausar de novo a partir de ${dateBR(next)}.`);
  }
  // Mensal no Mercado Pago: a assinatura para de cobrar já (o período atual está pago)
  if (sub.provider === "MERCADOPAGO" && sub.mpPreapprovalId && sub.mpSubscriptionStatus !== "cancelled") {
    await setPreapprovalStatus(sub.mpPreapprovalId, "paused");
    await prisma.subscription.update({ where: { id: sub.id }, data: { mpSubscriptionStatus: "paused" } });
  }
  // Asaas: a recorrência fica inativa e as cobranças já geradas para o período da pausa são apagadas
  if (sub.provider === "ASAAS" && sub.asaasSubscriptionId) {
    await asaas.setSubscriptionStatus(sub.asaasSubscriptionId, "INACTIVE");
    const from = asaas.asaasDate(sub.currentPeriodEnd);
    for (const p of await asaas.listSubscriptionPayments(sub.asaasSubscriptionId)) {
      if (p.status === "PENDING" && !p.deleted && p.dueDate >= from) await asaas.deletePayment(p.id).catch(() => {});
    }
    await prisma.invoice.updateMany({ where: { subscriptionId: sub.id, kind: "PLAN", status: "PENDING", asaasPaymentId: { not: null } }, data: { status: "CANCELED" } });
    await prisma.subscription.update({ where: { id: sub.id }, data: { mpSubscriptionStatus: "INACTIVE" } });
  }
  // Anual: link de renovação já gerado deixa de valer (é refeito perto do fim da pausa)
  await prisma.invoice.updateMany({ where: { subscriptionId: sub.id, kind: "PLAN", status: "PENDING" }, data: { status: "CANCELED" } });

  const from = sub.currentPeriodEnd;
  const until = addMonths(from, months);
  await prisma.subscription.update({ where: { id: sub.id }, data: { pauseFrom: from, pauseUntil: until, lastPauseAt: new Date() } });
  await event(sub.id, "pause_scheduled", 0, `${months} ${months === 1 ? "mês" : "meses"}: ${dateBR(from)} a ${dateBR(until)}`);
  await emailCustomer(sub.customerEmail, "Pausa agendada", [
    "Pausa agendada",
    `Sua loja ${sub.storeName} funciona normalmente até ${dateBR(from)}. Depois disso, a assinatura fica pausada até ${dateBR(until)}, sem nenhuma cobrança.`,
    `Em ${dateBR(until)} ela volta sozinha. Quer voltar antes? É só retomar na sua área de cliente.`,
  ], { label: "Ver minha assinatura", url: "/conta" });
  await notifyOwner(`Pausa agendada: ${sub.storeName}`, `De ${dateBR(from)} a ${dateBR(until)} (${months} ${months === 1 ? "mês" : "meses"}). Suspenda a loja durante a pausa.\n\n${subscriptionSummary(sub, await planName(sub.plan))}`);
  return `Pausa agendada de ${dateBR(from)} a ${dateBR(until)}. Nada será cobrado nesse período.`;
}

/** Retomar: desfaz a pausa agendada ou volta agora de uma pausa em andamento. */
export async function resumeSubscription(subId: string, userId: string): Promise<string> {
  const sub = await ownedSubscription(subId, userId);
  if (sub.status === "ACTIVE" && sub.pauseFrom) {
    if (sub.provider === "ASAAS" && sub.asaasSubscriptionId && sub.mpSubscriptionStatus === "INACTIVE") {
      await asaas.setSubscriptionStatus(sub.asaasSubscriptionId, "ACTIVE", asaas.asaasDate(sub.currentPeriodEnd));
      await prisma.subscription.update({ where: { id: sub.id }, data: { mpSubscriptionStatus: "ACTIVE" } });
    }
    if (sub.provider === "MERCADOPAGO" && sub.mpPreapprovalId && sub.mpSubscriptionStatus === "paused") {
      await setPreapprovalStatus(sub.mpPreapprovalId, "authorized");
      await prisma.subscription.update({ where: { id: sub.id }, data: { mpSubscriptionStatus: "authorized" } });
    }
    await prisma.subscription.update({ where: { id: sub.id }, data: { pauseFrom: null, pauseUntil: null, lastPauseAt: null } });
    await event(sub.id, "pause_canceled");
    await notifyOwner(`Pausa cancelada: ${sub.storeName}`, `A assinatura segue normalmente.\n\n${subscriptionSummary(sub, await planName(sub.plan))}`);
    return "Pausa cancelada: a assinatura segue normalmente.";
  }
  if (sub.status === "PAUSED") {
    await restart(sub, new Date());
    return sub.provider === "MERCADOPAGO" && sub.cycle === "MENSAL" ? "Assinatura retomada: a cobrança mensal volta no seu cartão." : "Assinatura retomada: a cobrança do novo período foi gerada.";
  }
  throw new BillingError("A assinatura não está pausada.");
}

/** Começo da pausa (fim do período pago). */
async function startPause(sub: Subscription): Promise<void> {
  await prisma.subscription.update({ where: { id: sub.id }, data: { status: "PAUSED" } });
  sub.status = "PAUSED";
  await event(sub.id, "paused", 0, `até ${dateBR(sub.pauseUntil)}`);
  await emailCustomer(sub.customerEmail, "Sua assinatura está pausada", [
    "Sua assinatura está pausada",
    `Nenhuma cobrança será feita até ${dateBR(sub.pauseUntil)}, quando ela volta sozinha. Quer voltar antes? Retome na sua área de cliente.`,
  ], { label: "Ver minha assinatura", url: "/conta" });
  await notifyOwner(`Pausa começou: ${sub.storeName}`, `Suspenda a loja até ${dateBR(sub.pauseUntil)}.\n\n${subscriptionSummary(sub, await planName(sub.plan))}`);
}

/** Volta da pausa: assinatura ativa de novo a partir de `start`, com a cobrança do novo período. */
async function restart(sub: Subscription, start: Date): Promise<void> {
  const name = await planName(sub.nextPlan ?? sub.plan);
  const prepaid = usesOwnRenewal(sub) && !!sub.currentPeriodEnd && sub.currentPeriodEnd > start && !!sub.pauseUntil && sub.currentPeriodStart?.getTime() === sub.pauseUntil.getTime();
  if (sub.provider === "ASAAS" && sub.asaasSubscriptionId && sub.mpSubscriptionStatus === "INACTIVE") {
    try {
      // Se houver troca de plano agendada, o novo valor já vale nesta cobrança
      if (sub.nextPlan && sub.nextPlanPriceCents) await asaas.updateSubscriptionValue(sub.asaasSubscriptionId, sub.nextPlanPriceCents, `VirtualStore ${await planName(sub.nextPlan)} · ${cycleWord(sub.cycle)}`);
      await asaas.setSubscriptionStatus(sub.asaasSubscriptionId, "ACTIVE", asaas.asaasDate(start));
      await prisma.subscription.update({ where: { id: sub.id }, data: { mpSubscriptionStatus: "ACTIVE" } });
    } catch (err) {
      console.error("[billing] não foi possível retomar no Asaas:", err);
    }
  }
  if (sub.provider === "MERCADOPAGO" && sub.mpPreapprovalId && sub.mpSubscriptionStatus === "paused") {
    try {
      await setPreapprovalStatus(sub.mpPreapprovalId, "authorized");
      await prisma.subscription.update({ where: { id: sub.id }, data: { mpSubscriptionStatus: "authorized" } });
    } catch (err) {
      console.error("[billing] não foi possível retomar no Mercado Pago:", err);
    }
  }
  const updated = await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      status: "ACTIVE",
      pauseFrom: null,
      pauseUntil: null,
      // Período novo começa agora; o mensal é cobrado pelo Mercado Pago, o anual paga a renovação
      ...(prepaid ? {} : { currentPeriodStart: start, currentPeriodEnd: start, ...applyNextPlan(sub) }),
    },
  });
  Object.assign(sub, updated);
  await event(sub.id, "resumed");
  await emailCustomer(sub.customerEmail, "Sua assinatura voltou", [
    "Sua assinatura voltou",
    prepaid
      ? `A pausa terminou e a loja ${sub.storeName} está ativa de novo, até ${dateBR(sub.currentPeriodEnd)}.`
      : sub.provider === "MERCADOPAGO" && sub.cycle === "MENSAL"
        ? `A pausa terminou e a loja ${sub.storeName} está ativa de novo. A mensalidade do plano ${name} volta a ser cobrada no seu cartão.`
        : `A pausa terminou. Para manter a loja ${sub.storeName} no ar, pague a cobrança do novo período na sua área de cliente.`,
  ], { label: "Ver minha assinatura", url: "/conta" });
  await notifyOwner(`Pausa terminou: ${sub.storeName}`, `Reative a loja.\n\n${subscriptionSummary(sub, name)}`);
  if (usesOwnRenewal(sub) && !prepaid) {
    const s = await getSettings();
    await ensureRenewalInvoice(sub, s.annual_max_installments);
    await markPastDue(sub, "A pausa terminou e a cobrança do novo período ainda não foi paga.");
  }
  if (sub.provider === "ASAAS") await reconcileAsaas(sub).catch((err) => console.error("[billing] conferência no Asaas:", err));
}

/** Trocar de plano: vale a partir da próxima renovação, sem cobrança dupla. Escolher o plano atual desfaz a troca. */
export async function changePlan(subId: string, userId: string, planId: string): Promise<string> {
  const sub = await ownedSubscription(subId, userId);
  if (sub.status !== "ACTIVE" || sub.cancelAtPeriodEnd) throw new BillingError("A troca de plano fica disponível com a assinatura ativa.");
  const s = await getSettings();
  const renewal = dateBR(sub.pauseUntil ?? sub.currentPeriodEnd);

  if (planId === sub.plan) {
    if (!sub.nextPlan) throw new BillingError("Esse já é o seu plano.");
    if (sub.provider === "MERCADOPAGO" && sub.mpPreapprovalId && sub.mpSubscriptionStatus !== "cancelled") await setPreapprovalAmount(sub.mpPreapprovalId, sub.planPriceCents);
    if (sub.provider === "ASAAS" && sub.asaasSubscriptionId) await asaas.updateSubscriptionValue(sub.asaasSubscriptionId, sub.planPriceCents, `VirtualStore ${await planName(sub.plan)} · ${cycleWord(sub.cycle)}`);
    await prisma.invoice.updateMany({ where: { subscriptionId: sub.id, kind: "PLAN", status: "PENDING" }, data: { status: "CANCELED" } });
    await prisma.subscription.update({ where: { id: sub.id }, data: { nextPlan: null, nextPlanPriceCents: null } });
    await event(sub.id, "plan_change_canceled");
    return `Troca cancelada: você continua no plano ${await planName(sub.plan)}.`;
  }

  const plan = await getPlan(planId, { activeOnly: true });
  if (!plan) throw new BillingError("Plano não encontrado.");
  const price = planPriceCents(plan, sub.cycle as Cycle, s);
  if (sub.provider === "MERCADOPAGO" && sub.mpPreapprovalId && sub.mpSubscriptionStatus !== "cancelled") await setPreapprovalAmount(sub.mpPreapprovalId, price);
  if (sub.provider === "ASAAS" && sub.asaasSubscriptionId) await asaas.updateSubscriptionValue(sub.asaasSubscriptionId, price, `VirtualStore ${plan.name} · ${cycleWord(sub.cycle)}`);
  // Renovação feita pelo site: o link com o valor antigo deixa de valer (é refeito com o novo)
  if (usesOwnRenewal(sub)) await prisma.invoice.updateMany({ where: { subscriptionId: sub.id, kind: "PLAN", status: "PENDING" }, data: { status: "CANCELED" } });
  await prisma.subscription.update({ where: { id: sub.id }, data: { nextPlan: plan.id, nextPlanPriceCents: price } });
  const from = await planName(sub.plan);
  await event(sub.id, "plan_change", price, `${from} → ${plan.name}`);
  const per = sub.cycle === "ANUAL" ? "/ano" : "/mês";
  await emailCustomer(sub.customerEmail, "Troca de plano agendada", [
    "Troca de plano agendada",
    `A partir de ${renewal}, a loja ${sub.storeName} passa do plano ${from} para o ${plan.name}, por ${money(price)}${per}. Até lá nada muda e não há cobrança extra.`,
  ], { label: "Ver minha assinatura", url: "/conta" });
  await notifyOwner(`Troca de plano agendada: ${sub.storeName}`, `${from} → ${plan.name} (${money(price)}${per}) a partir de ${renewal}. Ajuste os recursos da loja nessa data.\n\n${subscriptionSummary(sub, from)}`);
  return `A partir de ${renewal} você passa para o plano ${plan.name} (${money(price)}${per}), sem cobrança dupla.`;
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
          if (sub.mpPreapprovalId || sub.asaasSubscriptionId || (await prisma.invoice.count({ where: { subscriptionId: sub.id, reference: { not: null } } }))) sub = await reconcile(sub);
          if (sub.status === "PENDING") {
            await endSubscription(sub, "CANCELED", "not_paid");
            count.discarded++;
          }
        }
        continue;
      }

      if (sub.status === "ACTIVE" && sub.pauseFrom && now >= sub.pauseFrom) {
        // startPause muda o status para PAUSED: segue para o bloco abaixo na mesma rodada
        await startPause(sub);
        count.paused = (count.paused ?? 0) + 1;
      }

      if (sub.status === "PAUSED") {
        if (sub.pauseUntil && now >= sub.pauseUntil) {
          await restart(sub, sub.pauseUntil);
          count.resumed = (count.resumed ?? 0) + 1;
        } else if (usesOwnRenewal(sub) && sub.pauseUntil && sub.pauseUntil.getTime() - now.getTime() <= s.renewal_notice_days * DAY && !(sub.currentPeriodEnd && sub.currentPeriodEnd > sub.pauseUntil)) {
          const inv = await ensureRenewalInvoice(sub, s.annual_max_installments);
          if (await addReminder(sub, `pause_renew:${sub.pauseUntil.toISOString().slice(0, 10)}`)) {
            await emailCustomer(sub.customerEmail, "Sua pausa está terminando", [
              "Sua pausa está terminando",
              `A pausa da loja ${sub.storeName} termina em ${dateBR(sub.pauseUntil)}. Para ela voltar ao ar, pague a renovação de ${money(inv.amountCents)} no Pix ou em até ${s.annual_max_installments}x no cartão.`,
              "Não quer continuar? Você pode cancelar na sua área de cliente; nada será cobrado.",
            ], { label: "Pagar renovação", url: inv.payUrl ?? "/conta" });
            count.renewals++;
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
            // Gateway que cobra sozinho (MP mensal, Asaas): espera até 2 dias pela confirmação
            if (usesOwnRenewal(sub) || now >= addDays(sub.currentPeriodEnd, 2)) {
              if (usesOwnRenewal(sub)) await ensureRenewalInvoice(sub, s.annual_max_installments);
              await markPastDue(sub, usesOwnRenewal(sub) ? "A renovação não foi paga." : "A cobrança não foi confirmada.");
              count.pastDue++;
            }
          }
          continue;
        }
        // Anual: link da renovação alguns dias antes, com lembrete a 3 dias
        if (usesOwnRenewal(sub) && !sub.cancelAtPeriodEnd && !sub.pauseFrom && end.getTime() - now.getTime() <= s.renewal_notice_days * DAY) {
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
