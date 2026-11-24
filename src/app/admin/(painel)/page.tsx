import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { getPlan } from "@/lib/plans";
import { cycleLabel, dateTime, money } from "@/lib/format";
import { DomainBadge, StageBadge, StatusBadge } from "@/components/Badges";

const TABS = [
  { id: "implantar", label: "Para implantar", where: { status: "PAID", stage: { in: ["NOVO", "CONFIGURANDO"] } } },
  { id: "pagas", label: "Pagas", where: { status: "PAID" } },
  { id: "pendentes", label: "Aguardando pagamento", where: { status: "PENDING" } },
  { id: "todas", label: "Todas", where: {} },
] satisfies { id: string; label: string; where: Prisma.SubscriptionWhereInput }[];

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  await requireAdmin();
  const { aba } = await searchParams;
  const tab = TABS.find((t) => t.id === aba) ?? TABS[0];

  const [rows, paid, toSetup, pending] = await Promise.all([
    prisma.subscription.findMany({ where: tab.where, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.subscription.findMany({ where: { status: "PAID" }, select: { cycle: true, planPriceCents: true } }),
    prisma.subscription.count({ where: TABS[0].where }),
    prisma.subscription.count({ where: { status: "PENDING" } }),
  ]);
  // Receita recorrente mensal: anual conta como 1/12 por mês
  const mrr = paid.reduce((s, p) => s + (p.cycle === "ANUAL" ? Math.round(p.planPriceCents / 12) : p.planPriceCents), 0);

  return (
    <>
      <h1>Assinaturas</h1>
      <div className="kpis">
        <div className="kpi">
          <small>Assinaturas ativas</small>
          <b>{paid.length}</b>
        </div>
        <div className="kpi">
          <small>Receita recorrente / mês</small>
          <b>{money(mrr)}</b>
        </div>
        <div className="kpi">
          <small>Para implantar</small>
          <b>{toSetup}</b>
        </div>
        <div className="kpi">
          <small>Aguardando pagamento</small>
          <b>{pending}</b>
        </div>
      </div>

      <nav className="tabs" aria-label="Filtro">
        {TABS.map((t) => (
          <Link key={t.id} href={`/admin?aba=${t.id}`} className={t.id === tab.id ? "on" : ""}>
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="table-wrap">
        {rows.length === 0 ? (
          <p className="empty">Nenhuma assinatura aqui ainda.</p>
        ) : (
          <table className="list">
            <thead>
              <tr>
                <th>Data</th>
                <th>Loja / cliente</th>
                <th>Plano</th>
                <th>Domínio</th>
                <th>Pagamento</th>
                <th>Implantação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>
                    <small>{dateTime(s.createdAt)}</small>
                    <br />
                    <small>{s.code}</small>
                  </td>
                  <td>
                    <Link href={`/admin/assinaturas/${s.id}`} style={{ color: "var(--blue)" }}>
                      <b>{s.storeName}</b>
                    </Link>
                    <small>{s.customerName}</small>
                  </td>
                  <td>
                    <b>{getPlan(s.plan)?.name ?? s.plan}</b>
                    <small>
                      {cycleLabel(s.cycle)} · {money(s.planPriceCents)}
                    </small>
                  </td>
                  <td>
                    <b style={{ fontWeight: 600 }}>{s.domain}</b>
                    <DomainBadge option={s.domainOption} paid={!!s.domainPaidAt} />
                  </td>
                  <td>
                    <StatusBadge status={s.status} />
                  </td>
                  <td>
                    <StageBadge stage={s.stage} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
