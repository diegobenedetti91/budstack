import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { planNames } from "@/lib/plans";
import { dateBR } from "@/lib/billing";
import { cycleLabel, money } from "@/lib/format";
import { sourceLabel } from "@/lib/tracking";
import { DomainBadge, StageBadge, StatusBadge } from "@/components/Badges";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Clientes" };

const TABS = [
  { id: "ativos", label: "Ativos", where: { status: "ACTIVE", cancelAtPeriodEnd: false } },
  { id: "inadimplentes", label: "Inadimplentes", where: { status: "PAST_DUE" } },
  { id: "pausados", label: "Pausados", where: { OR: [{ status: "PAUSED" }, { status: "ACTIVE", pauseFrom: { not: null } }] } },
  { id: "cancelando", label: "Cancelamento agendado", where: { status: "ACTIVE", cancelAtPeriodEnd: true } },
  { id: "implantar", label: "Para implantar", where: { status: { in: ["ACTIVE", "PAST_DUE", "PAUSED"] }, stage: { in: ["NOVO", "CONFIGURANDO"] } } },
  { id: "pendentes", label: "Aguardando pagamento", where: { status: "PENDING" } },
  { id: "encerrados", label: "Encerrados", where: { status: { in: ["CANCELED", "EXPIRED"] }, paidAt: { not: null } } },
  { id: "todos", label: "Todos", where: {} },
] satisfies { id: string; label: string; where: Prisma.SubscriptionWhereInput }[];

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ aba?: string; q?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t.id === sp.aba) ?? TABS[0];
  const q = (sp.q ?? "").trim().slice(0, 80);
  const search: Prisma.SubscriptionWhereInput = q
    ? { OR: ["storeName", "customerName", "customerEmail", "domain", "code"].map((k) => ({ [k]: { contains: q } })) }
    : {};

  const [rows, counts, names] = await Promise.all([
    prisma.subscription.findMany({ where: { AND: [tab.where, search] }, orderBy: { createdAt: "desc" }, take: 300 }),
    Promise.all(TABS.map((t) => prisma.subscription.count({ where: t.where }))),
    planNames(),
  ]);

  return (
    <>
      <PageHeader title="Clientes" subtitle="Assinaturas por situação. Clique na loja para ver pagamentos, histórico e implantação." />

      <div className="toolbar">
        <nav className="tabs" aria-label="Filtro" style={{ margin: 0 }}>
          {TABS.map((t, i) => (
            <Link key={t.id} href={`/admin/clientes?aba=${t.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={t.id === tab.id ? "on" : ""}>
              {t.label} <span style={{ opacity: 0.7 }}>{counts[i]}</span>
            </Link>
          ))}
        </nav>
        <form className="search" role="search">
          <input type="hidden" name="aba" value={tab.id} />
          <input name="q" defaultValue={q} placeholder="Buscar loja, cliente, e-mail, domínio…" aria-label="Buscar" />
          <button className="btn btn-ghost btn-sm">Buscar</button>
        </form>
      </div>

      <div className="table-wrap">
        {rows.length === 0 ? (
          <p className="empty">Nenhum cliente aqui.</p>
        ) : (
          <table className="list">
            <thead>
              <tr>
                <th>Loja / cliente</th>
                <th>Plano</th>
                <th>Situação</th>
                <th>{tab.id === "inadimplentes" ? "Tolerância até" : tab.id === "pausados" ? "Pausa" : "Vence / até"}</th>
                <th>Domínio</th>
                <th>Implantação</th>
                <th>Origem</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link href={`/admin/clientes/${s.id}`} style={{ color: "var(--blue)" }}>
                      <b>{s.storeName}</b>
                    </Link>
                    <small>
                      {s.customerName} · {s.code}
                    </small>
                  </td>
                  <td>
                    <b>{names.get(s.plan) ?? s.plan}</b>
                    <small>
                      {cycleLabel(s.cycle)} · {money(s.planPriceCents)}
                    </small>
                  </td>
                  <td>
                    <StatusBadge sub={s} />
                  </td>
                  <td>
                    {s.status === "PAST_DUE" ? dateBR(s.graceUntil) : s.status === "PAUSED" || s.pauseFrom ? `${dateBR(s.pauseFrom)} a ${dateBR(s.pauseUntil)}` : s.status === "ACTIVE" ? dateBR(s.currentPeriodEnd) : <small>{dateBR(s.endedAt ?? s.createdAt)}</small>}
                    {s.nextPlan && <small>troca → {names.get(s.nextPlan) ?? s.nextPlan}</small>}
                  </td>
                  <td>
                    <b style={{ fontWeight: 600 }}>{s.domain}</b>
                    <DomainBadge option={s.domainOption} paid={!!s.domainPaidAt} />
                  </td>
                  <td>
                    <StageBadge stage={s.stage} />
                  </td>
                  <td>
                    <small>{s.source ? sourceLabel(s.source) : "—"}</small>
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
