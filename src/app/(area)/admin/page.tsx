import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { planNames } from "@/lib/plans";
import { dateBR, runBillingJobsThrottled } from "@/lib/billing";
import { money } from "@/lib/format";
import { StageBadge } from "@/components/Badges";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Visão geral" };

const monthly = (s: { cycle: string; planPriceCents: number }) => (s.cycle === "ANUAL" ? s.planPriceCents / 12 : s.planPriceCents);

export default async function AdminHome() {
  // Sem cron configurado, a rotina de cobrança roda ao abrir o painel (no máximo a cada 10 min)
  await runBillingJobsThrottled();

  const since30 = new Date(Date.now() - 30 * 864e5);
  const [active, pastDue, canceling, toSetup, pending, revenue30, names, paused] = await Promise.all([
    prisma.subscription.findMany({ where: { status: "ACTIVE" }, select: { cycle: true, planPriceCents: true } }),
    prisma.subscription.findMany({ where: { status: "PAST_DUE" }, orderBy: { graceUntil: "asc" } }),
    prisma.subscription.findMany({ where: { status: "ACTIVE", cancelAtPeriodEnd: true }, orderBy: { currentPeriodEnd: "asc" } }),
    prisma.subscription.findMany({ where: { status: { in: ["ACTIVE", "PAST_DUE"] }, stage: { in: ["NOVO", "CONFIGURANDO"] } }, orderBy: { paidAt: "asc" } }),
    prisma.subscription.count({ where: { status: "PENDING" } }),
    prisma.invoice.aggregate({ where: { status: "PAID", paidAt: { gte: since30 } }, _sum: { amountCents: true } }),
    planNames(),
    prisma.subscription.findMany({ where: { OR: [{ status: "PAUSED" }, { status: "ACTIVE", pauseFrom: { not: null } }] }, orderBy: { pauseFrom: "asc" } }),
  ]);
  const mrr = active.reduce((a, s) => a + monthly(s), 0);

  const List = ({ title, rows, empty, right }: { title: string; rows: typeof pastDue; empty: string; right: (s: (typeof pastDue)[number]) => React.ReactNode }) => (
    <section className="card">
      <h2>
        {title} <span className="badge gray">{rows.length}</span>
      </h2>
      {rows.length === 0 ? (
        <p className="muted" style={{ fontSize: 14 }}>
          {empty}
        </p>
      ) : (
        <ul style={{ display: "grid", gap: 10 }}>
          {rows.slice(0, 8).map((s) => (
            <li key={s.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14 }}>
              <span>
                <Link href={`/admin/clientes/${s.id}`} style={{ color: "var(--blue)", fontWeight: 700 }}>
                  {s.storeName}
                </Link>{" "}
                <span className="muted">· {names.get(s.plan) ?? s.plan}</span>
              </span>
              <span style={{ whiteSpace: "nowrap" }}>{right(s)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <>
      <PageHeader title="Visão geral" subtitle="O que precisa da sua atenção hoje." />

      <div className="kpis">
        <div className="kpi">
          <small>Clientes ativos</small>
          <b>{active.length}</b>
        </div>
        <div className="kpi">
          <small>Receita recorrente / mês</small>
          <b>{money(Math.round(mrr))}</b>
        </div>
        <div className="kpi">
          <small>Recebido em 30 dias</small>
          <b>{money(revenue30._sum.amountCents ?? 0)}</b>
        </div>
        <div className="kpi">
          <small>Inadimplentes</small>
          <b style={{ color: pastDue.length ? "#B42318" : undefined }}>{pastDue.length}</b>
        </div>
      </div>

      <div className="detail" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 0 }}>
        <List title="Inadimplentes" rows={pastDue} empty="Ninguém em atraso." right={(s) => <span className="badge red">até {dateBR(s.graceUntil)}</span>} />
        <List title="Para implantar" rows={toSetup} empty="Nenhuma loja esperando implantação." right={(s) => <StageBadge stage={s.stage} />} />
        <List title="Cancelamentos agendados" rows={canceling} empty="Nenhum cancelamento agendado." right={(s) => <span className="muted">no ar até {dateBR(s.currentPeriodEnd)}</span>} />
        <List title="Pausas" rows={paused} empty="Nenhuma loja pausada." right={(s) => <span className="badge blue">{s.status === "PAUSED" ? "até" : "a partir de"} {dateBR(s.status === "PAUSED" ? s.pauseUntil : s.pauseFrom)}</span>} />
        <section className="card">
          <h2>Atalhos</h2>
          <ul style={{ display: "grid", gap: 10, fontSize: 14.5 }}>
            <li>
              <Link href="/admin/clientes?aba=pendentes" style={{ color: "var(--blue)", fontWeight: 600 }}>
                {pending} pedido(s) aguardando pagamento
              </Link>
            </li>
            <li>
              <Link href="/admin/bi" style={{ color: "var(--blue)", fontWeight: 600 }}>
                BI: captação, conversão e churn
              </Link>
            </li>
            <li>
              <Link href="/admin/planos" style={{ color: "var(--blue)", fontWeight: 600 }}>
                Editar planos, preços e recursos
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}
