import "server-only";
import { prisma } from "./prisma";
import { planNames } from "./plans";
import { sourceLabel } from "./tracking";

/**
 * BI do site: só números agregados (contagens, somas, percentuais), nunca dados de uma pessoa.
 * O período (7/30/90/365 dias) vale para captação, receita, novas assinaturas e churn;
 * MRR, base ativa e mix olham o momento atual; a série mensal olha os últimos 12 meses.
 */

const DAY = 864e5;
const n = (v: unknown) => Number(v ?? 0);
/** Mês (AAAA-MM) no fuso de Brasília. */
const monthKey = (d: Date) => new Date(d.getTime() - 3 * 3600e3).toISOString().slice(0, 7);
const monthly = (s: { cycle: string; planPriceCents: number }) => (s.cycle === "ANUAL" ? s.planPriceCents / 12 : s.planPriceCents);

export async function biData(days: number) {
  const now = new Date();
  const since = new Date(now.getTime() - days * DAY);
  const yearAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1, 3));

  const [subs, invoices, churnEvents, names, visitorsRow, sourcesRows, pagesRows, planosRow, assinarRow] = await Promise.all([
    prisma.subscription.findMany({
      select: { id: true, plan: true, cycle: true, planPriceCents: true, totalCents: true, status: true, cancelAtPeriodEnd: true, createdAt: true, paidAt: true, endedAt: true, canceledAt: true, cancelReason: true, domainOption: true, source: true, visitorId: true },
    }),
    prisma.invoice.findMany({ where: { status: "PAID", paidAt: { gte: yearAgo < since ? yearAgo : since } }, select: { amountCents: true, paidAt: true } }),
    prisma.subscriptionEvent.findMany({ where: { kind: { in: ["canceled", "expired"] }, createdAt: { gte: yearAgo < since ? yearAgo : since }, NOT: { detail: "not_paid" } }, select: { subscriptionId: true, createdAt: true, kind: true } }),
    planNames(),
    prisma.$queryRaw<{ v: bigint }[]>`SELECT COUNT(DISTINCT visitorId) v FROM PageView WHERE createdAt >= ${since}`,
    prisma.$queryRaw<{ source: string; v: bigint }[]>`SELECT source, COUNT(DISTINCT visitorId) v FROM PageView WHERE createdAt >= ${since} GROUP BY source`,
    prisma.$queryRaw<{ path: string; views: bigint; v: bigint }[]>`SELECT path, COUNT(*) views, COUNT(DISTINCT visitorId) v FROM PageView WHERE createdAt >= ${since} GROUP BY path ORDER BY views DESC LIMIT 10`,
    prisma.$queryRaw<{ v: bigint }[]>`SELECT COUNT(DISTINCT visitorId) v FROM PageView WHERE createdAt >= ${since} AND path = '/planos'`,
    prisma.$queryRaw<{ v: bigint }[]>`SELECT COUNT(DISTINCT visitorId) v FROM PageView WHERE createdAt >= ${since} AND path = '/assinar'`,
  ]);

  const paying = subs.filter((s) => s.status === "ACTIVE" || s.status === "PAST_DUE");
  const active = subs.filter((s) => s.status === "ACTIVE");
  const pastDue = subs.filter((s) => s.status === "PAST_DUE");
  const paused = subs.filter((s) => s.status === "PAUSED");
  const canceling = active.filter((s) => s.cancelAtPeriodEnd);
  const mrr = active.reduce((a, s) => a + monthly(s), 0);
  const mrrAtRisk = pastDue.reduce((a, s) => a + monthly(s), 0) + canceling.reduce((a, s) => a + monthly(s), 0);

  const inPeriod = (d: Date | null) => !!d && d >= since;
  const newPaid = subs.filter((s) => inPeriod(s.paidAt));
  const revenue = invoices.filter((i) => inPeriod(i.paidAt)).reduce((a, i) => a + i.amountCents, 0);
  const churnedIds = new Set(churnEvents.filter((e) => e.createdAt >= since).map((e) => e.subscriptionId));
  const atStart = subs.filter((s) => s.paidAt && s.paidAt < since && (!s.endedAt || s.endedAt >= since)).length;
  const churnRate = atStart ? churnedIds.size / atStart : null;
  const monthlyChurn = churnRate !== null ? churnRate * (30 / days) : null;
  const arpa = paying.length ? (mrr + pastDue.reduce((a, s) => a + monthly(s), 0)) / paying.length : 0;
  const ltv = monthlyChurn && monthlyChurn > 0 ? arpa / monthlyChurn : null;
  const visitors = n(visitorsRow[0]?.v);
  const ticket = newPaid.length ? newPaid.reduce((a, s) => a + s.totalCents, 0) / newPaid.length : 0;

  // Funil do período: só pedidos de visitantes com visita registrada, para as etapas
  // serem da mesma população (quem bloqueia o contador de visitas fica de fora do funil)
  const ordersInPeriod = subs.filter((s) => s.createdAt >= since);
  const trackedOrders = ordersInPeriod.filter((s) => s.visitorId);
  const trackedPaid = trackedOrders.filter((s) => s.paidAt).length;
  const funnel = [
    { label: "Visitantes", value: visitors },
    { label: "Viram os planos", value: n(planosRow[0]?.v) },
    { label: "Abriram a assinatura", value: n(assinarRow[0]?.v) },
    { label: "Foram para o pagamento", value: trackedOrders.length },
    { label: "Pagaram", value: trackedPaid },
  ];

  // Captação por origem
  const bySource = new Map<string, { visitors: number; orders: number; paid: number; revenue: number }>();
  const row = (k: string) => bySource.get(k) ?? bySource.set(k, { visitors: 0, orders: 0, paid: 0, revenue: 0 }).get(k)!;
  for (const r of sourcesRows) row(r.source).visitors += n(r.v);
  for (const s of ordersInPeriod) {
    const r = row(s.source ?? "direto");
    r.orders++;
    if (s.paidAt) {
      r.paid++;
      r.revenue += s.totalCents;
    }
  }
  const sources = [...bySource.entries()]
    .map(([source, v]) => ({ source, label: sourceLabel(source), ...v, conversion: v.visitors ? v.paid / v.visitors : null }))
    .sort((a, b) => b.paid - a.paid || b.visitors - a.visitors)
    .slice(0, 12);

  // Últimos 12 meses
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) months.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 15))));
  const series = months.map((m) => ({
    month: m,
    revenue: invoices.filter((i) => i.paidAt && monthKey(i.paidAt) === m).reduce((a, i) => a + i.amountCents, 0),
    newPaid: subs.filter((s) => s.paidAt && monthKey(s.paidAt) === m).length,
    ended: new Set(churnEvents.filter((e) => monthKey(e.createdAt) === m).map((e) => e.subscriptionId)).size,
  }));

  // Mix da base ativa
  const planMix = [...new Set(paying.map((s) => s.plan))]
    .map((plan) => {
      const list = paying.filter((s) => s.plan === plan);
      return { label: names.get(plan) ?? plan, count: list.length, mrr: list.filter((s) => s.status === "ACTIVE").reduce((a, s) => a + monthly(s), 0) };
    })
    .sort((a, b) => b.mrr - a.mrr);
  const cycleMix = [
    { label: "Mensal", value: paying.filter((s) => s.cycle === "MENSAL").length },
    { label: "Anual", value: paying.filter((s) => s.cycle === "ANUAL").length },
  ];
  const domainMix = [
    { label: "Já tinham domínio", value: paying.filter((s) => s.domainOption === "OWN").length },
    { label: "BudStack registrou", value: paying.filter((s) => s.domainOption === "REGISTER").length },
  ];

  // Motivos de cancelamento no período
  const reasons = new Map<string, number>();
  for (const s of subs) {
    if (!s.canceledAt || s.canceledAt < since || !s.paidAt) continue;
    const k = s.cancelReason?.startsWith("Outro:") ? "Outro motivo" : s.cancelReason || "Não informado";
    reasons.set(k, (reasons.get(k) ?? 0) + 1);
  }

  return {
    days,
    kpis: {
      mrr,
      arr: mrr * 12,
      active: active.length - canceling.length,
      canceling: canceling.length,
      paused: paused.length,
      pastDue: pastDue.length,
      mrrAtRisk,
      revenue,
      newPaid: newPaid.length,
      churned: churnedIds.size,
      churnRate,
      ticket,
      arpa,
      ltv,
      visitors,
      conversion: visitors ? Math.min(1, trackedPaid / visitors) : null,
      untrackedOrders: ordersInPeriod.length - trackedOrders.length,
    },
    funnel,
    sources,
    pages: pagesRows.map((p) => ({ label: p.path, views: n(p.views), visitors: n(p.v) })),
    series,
    planMix,
    cycleMix,
    domainMix,
    reasons: [...reasons.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
  };
}

export type BiData = Awaited<ReturnType<typeof biData>>;
