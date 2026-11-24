import type { Metadata } from "next";
import Link from "next/link";
import { biData } from "@/lib/bi";
import { BarList } from "@/components/BarList";
import { ColumnChart } from "@/components/Charts";
import { fmt } from "@/lib/chart-format";

export const metadata: Metadata = { title: "BI" };

const PERIODS = [7, 30, 90, 365];
const money = (v: number) => fmt(v, "money");
const int = (v: number) => fmt(v, "int");
const pct = (v: number | null) => (v === null ? "—" : fmt(v, "pct"));

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="kpi">
      <small>{label}</small>
      <b>{value}</b>
      {hint && <span className="kpi-hint">{hint}</span>}
    </div>
  );
}

export default async function BiPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const days = PERIODS.includes(Number(p)) ? Number(p) : 30;
  const d = await biData(days);
  const k = d.kpis;
  const funnelRows = d.funnel.map((f, i) => ({
    label: f.label,
    value: f.value,
    extra: i === 0 ? undefined : d.funnel[i - 1].value ? `${fmt(f.value / d.funnel[i - 1].value, "pct")} da etapa anterior` : undefined,
  }));

  return (
    <>
      <div className="toolbar" style={{ marginTop: 0 }}>
        <div>
          <h1>BI</h1>
          <p className="page-sub">Captação, conversão, receita e retenção do site. Só números agregados.</p>
        </div>
        <nav className="tabs" aria-label="Período" style={{ margin: 0 }}>
          {PERIODS.map((n) => (
            <Link key={n} href={`/admin/bi?p=${n}`} className={n === days ? "on" : ""}>
              {n === 365 ? "12 meses" : `${n} dias`}
            </Link>
          ))}
        </nav>
      </div>

      <h2 className="section-title" style={{ marginTop: 8 }}>Receita</h2>
      <div className="kpis">
        <Kpi label="Receita recorrente (MRR)" value={money(k.mrr)} hint={`ARR ${money(k.arr)}`} />
        <Kpi label={`Recebido em ${days === 365 ? "12 meses" : `${days} dias`}`} value={money(k.revenue)} />
        <Kpi label="Ticket médio (1º pagamento)" value={money(k.ticket)} />
        <Kpi label="Valor por cliente (LTV)" value={k.ltv ? money(k.ltv) : "—"} hint={`média ${money(k.arpa)}/mês`} />
      </div>

      <h2 className="section-title">Base de clientes</h2>
      <div className="kpis">
        <Kpi label="Ativos" value={int(k.active)} hint={[k.canceling ? `+${k.canceling} cancelando` : "", k.paused ? `${k.paused} pausada(s)` : ""].filter(Boolean).join(" · ") || undefined} />
        <Kpi label="Inadimplentes" value={int(k.pastDue)} hint={`em risco: ${money(k.mrrAtRisk)}/mês`} />
        <Kpi label="Novas assinaturas" value={int(k.newPaid)} hint="pagas no período" />
        <Kpi label="Churn" value={pct(k.churnRate)} hint={`${int(k.churned)} encerrada(s) no período`} />
      </div>

      <div className="detail" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <section className="card">
          <h2>Funil de conversão</h2>
          <p className="muted" style={{ fontSize: 13.5, marginTop: -10, marginBottom: 14 }}>
            Conversão visitante → cliente: <b style={{ color: "var(--ink)" }}>{pct(k.conversion)}</b>
          </p>
          <BarList rows={funnelRows} format={int} />
          {k.untrackedOrders > 0 && (
            <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>
              {k.untrackedOrders} pedido(s) de quem não teve a visita registrada (ex.: bloqueador de anúncios) ficam fora do funil, mas entram na receita e nas origens.
            </p>
          )}
        </section>
        <section className="card">
          <h2>Origem dos clientes</h2>
          {d.sources.length === 0 ? (
            <p className="muted" style={{ fontSize: 14 }}>Sem visitas no período.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="mini-table">
                <thead>
                  <tr>
                    <th>Origem</th>
                    <th>Visitantes</th>
                    <th>Pedidos</th>
                    <th>Pagos</th>
                    <th>Conversão</th>
                    <th>Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {d.sources.map((s) => (
                    <tr key={s.source}>
                      <td>
                        <b>{s.label}</b>
                      </td>
                      <td>{int(s.visitors)}</td>
                      <td>{int(s.orders)}</td>
                      <td>{int(s.paid)}</td>
                      <td>{pct(s.conversion)}</td>
                      <td>{money(s.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>
            Origem por UTM (utm_source), clique de anúncio (Google/Meta) ou site de onde a pessoa veio. Use links com ?utm_source=instagram&utm_campaign=… nas campanhas.
          </p>
        </section>
      </div>

      <div className="detail" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <section className="card">
          <h2>Receita recebida por mês</h2>
          <ColumnChart label="Receita recebida por mês, últimos 12 meses" data={d.series.map((m) => ({ key: m.month, values: [m.revenue] }))} series={["Receita"]} kind="money" />
        </section>
        <section className="card">
          <h2>Novas × encerradas por mês</h2>
          <ColumnChart label="Assinaturas novas e encerradas por mês" data={d.series.map((m) => ({ key: m.month, values: [m.newPaid, m.ended] }))} series={["Novas", "Encerradas"]} kind="int" />
        </section>
      </div>

      <div className="detail" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <section className="card">
          <h2>Planos na base ativa</h2>
          <BarList rows={d.planMix.map((p) => ({ label: p.label, value: p.mrr, extra: `${p.count} cliente(s)` }))} format={(v) => `${money(v)}/mês`} note="Nenhum cliente ativo ainda." />
          <div className="grid2" style={{ marginTop: 18 }}>
            <div>
              <b style={{ fontSize: 14 }}>Ciclo</b>
              <BarList rows={d.cycleMix} format={int} />
            </div>
            <div>
              <b style={{ fontSize: 14 }}>Domínio</b>
              <BarList rows={d.domainMix} format={int} />
            </div>
          </div>
        </section>
        <section className="card">
          <h2>Motivos de cancelamento</h2>
          <BarList rows={d.reasons} format={int} note="Nenhum cancelamento no período." />
          <h2 style={{ marginTop: 22 }}>Páginas mais vistas</h2>
          <BarList rows={d.pages.map((p) => ({ label: p.label, value: p.views, extra: `${int(p.visitors)} visitante(s)` }))} format={(v) => `${int(v)} visita(s)`} />
        </section>
      </div>
    </>
  );
}
