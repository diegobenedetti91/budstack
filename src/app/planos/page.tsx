import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getPlans, planPriceCents, type Cycle } from "@/lib/plans";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { money, whatsappUrl } from "@/lib/format";
import { Faq, HelpBox } from "@/components/Faq";

export const metadata: Metadata = {
  title: "Planos da VirtualStore",
  description: "Escolha o plano da sua loja virtual VirtualStore: mensal no cartão ou anual com desconto.",
};
export const dynamic = "force-dynamic";

export default async function PlanosPage({ searchParams }: { searchParams: Promise<{ ciclo?: string }> }) {
  const { ciclo } = await searchParams;
  const cycle: Cycle = ciclo === "anual" ? "ANUAL" : "MENSAL";
  const [plans, s, allFeatures] = await Promise.all([
    getPlans({ activeOnly: true }),
    getSettings(),
    prisma.feature.findMany({ where: { active: true }, orderBy: { sort: "asc" } }),
  ]);
  const freeMonths = 12 - s.annual_months_charged;
  // Comparativo: só recursos que pelo menos um plano ativo inclui
  const included = new Set(plans.flatMap((p) => p.features.map((f) => f.id)));
  const compare = allFeatures.filter((f) => included.has(f.id));

  return (
    <>
      <SiteHeader />
      <main>
        <section className="sec soft">
          <div className="wrap">
            <div className="sec-head">
              <span className="kicker">Planos VirtualStore</span>
              <h1>Escolha o plano da sua loja</h1>
              <p>Implantação inclusa em todos os planos. Cancele quando quiser, sem multa.</p>
              <div className="toggle" role="tablist" aria-label="Ciclo de cobrança">
                <Link href="/planos" className={cycle === "MENSAL" ? "on" : ""} role="tab" aria-selected={cycle === "MENSAL"} scroll={false}>
                  Mensal
                </Link>
                <Link href="/planos?ciclo=anual" className={cycle === "ANUAL" ? "on" : ""} role="tab" aria-selected={cycle === "ANUAL"} scroll={false}>
                  Anual {freeMonths > 0 && <em>{freeMonths === 1 ? "1 mês grátis" : `${freeMonths} meses grátis`}</em>}
                </Link>
              </div>
            </div>

            {plans.length === 0 ? (
              <p className="empty">Nenhum plano disponível no momento. Fale com a gente pelo WhatsApp.</p>
            ) : (
              <div className="plans" style={plans.length < 3 ? { gridTemplateColumns: `repeat(${plans.length}, minmax(0, 380px))`, justifyContent: "center" } : undefined}>
                {plans.map((plan) => {
                  const price = planPriceCents(plan, cycle, s);
                  return (
                    <article key={plan.id} id={plan.id} className={`plan${plan.highlight ? " hl" : ""}`}>
                      {plan.highlight && <span className="badge-top">Mais escolhido</span>}
                      <h3>{plan.name}</h3>
                      <p className="tl">{plan.tagline}</p>
                      <div className="price">
                        <b>{money(cycle === "ANUAL" ? Math.round(price / 12) : price)}</b>
                        <span>/mês</span>
                      </div>
                      <p className="sub">{cycle === "ANUAL" ? `${money(price)} por ano, em até ${s.annual_max_installments}x no cartão ou Pix` : "Cobrado todo mês no cartão"}</p>
                      <ul className="checks">
                        {plan.features.map((f) => (
                          <li key={f.id}>
                            <Icon name="check" className="ico sm" />
                            {f.name}
                          </li>
                        ))}
                      </ul>
                      <Link href={`/assinar?plano=${plan.id}&ciclo=${cycle === "ANUAL" ? "anual" : "mensal"}`} className={`btn btn-block ${plan.highlight ? "btn-primary" : "btn-ghost"}`}>
                        Assinar o {plan.name}
                      </Link>
                    </article>
                  );
                })}
              </div>
            )}

            {plans.length > 1 && compare.length > 0 && (
              <div style={{ marginTop: 56 }}>
                <h2 style={{ textAlign: "center", fontSize: 26, fontWeight: 800, marginBottom: 18 }}>Compare os planos</h2>
                <div className="table-wrap">
                  <table className="matrix">
                    <thead>
                      <tr>
                        <th>Recurso</th>
                        {plans.map((p) => (
                          <th key={p.id}>{p.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {compare.map((f) => (
                        <tr key={f.id}>
                          <td>{f.name}</td>
                          {plans.map((p) => (
                            <td key={p.id}>
                              {p.features.some((x) => x.id === f.id) ? (
                                <Icon name="check" className="ico sm" />
                              ) : (
                                <span className="muted" aria-label="Não incluso">
                                  —
                                </span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <ul className="conds">
              <li>
                <Icon name="clock" className="ico sm" />
                Loja no ar em até {s.setup_business_days} dias úteis depois do pagamento e do envio do logo e das informações da loja.
              </li>
              <li>
                <Icon name="globe" className="ico sm" />
                Não tem domínio? Registramos para você por {money(s.domain_fee_cents)} o primeiro ano.
              </li>
              <li>
                <Icon name="shield" className="ico sm" />
                Reembolso integral se cancelar em até {s.refund_days} dias após o primeiro pagamento.
              </li>
              <li>
                <Icon name="card" className="ico sm" />
                Pagamento seguro pelo Mercado Pago. Mensal no cartão; anual no Pix ou cartão parcelado.
              </li>
            </ul>
          </div>
        </section>

        <section className="sec">
          <div className="wrap">
            <div className="sec-head">
              <span className="kicker">Dúvidas</span>
              <h2>Perguntas frequentes</h2>
            </div>
            <Faq s={s} />
            <div style={{ maxWidth: 820, margin: "24px auto 0" }}>
              <HelpBox whatsapp={whatsappUrl(s.contact_whatsapp, "Olá! Estou vendo os planos da VirtualStore e tenho uma dúvida.")} />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
