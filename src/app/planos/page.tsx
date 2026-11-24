import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { ANNUAL_MAX_INSTALLMENTS, ANNUAL_MONTHS_CHARGED, DOMAIN_FEE_CENTS, PLANS, SETUP_BUSINESS_DAYS, planPriceCents, type Cycle } from "@/lib/plans";
import { money } from "@/lib/format";

export const metadata: Metadata = {
  title: "Planos da VirtualStore",
  description: "Escolha o plano da sua loja virtual VirtualStore: mensal no cartão ou anual com 2 meses grátis.",
};

export default async function PlanosPage({ searchParams }: { searchParams: Promise<{ ciclo?: string }> }) {
  const { ciclo } = await searchParams;
  const cycle: Cycle = ciclo === "anual" ? "ANUAL" : "MENSAL";
  const freeMonths = 12 - ANNUAL_MONTHS_CHARGED;

  return (
    <>
      <SiteHeader />
      <main>
        <section className="sec soft">
          <div className="wrap">
            <div className="sec-head">
              <span className="kicker">Planos VirtualStore</span>
              <h1>Escolha o plano da sua loja</h1>
              <p>Implantação inclusa em todos os planos. Sem fidelidade no mensal.</p>
              <div className="toggle" role="tablist" aria-label="Ciclo de cobrança">
                <Link href="/planos" className={cycle === "MENSAL" ? "on" : ""} role="tab" aria-selected={cycle === "MENSAL"} scroll={false}>
                  Mensal
                </Link>
                <Link href="/planos?ciclo=anual" className={cycle === "ANUAL" ? "on" : ""} role="tab" aria-selected={cycle === "ANUAL"} scroll={false}>
                  Anual <em>{freeMonths} meses grátis</em>
                </Link>
              </div>
            </div>

            <div className="plans">
              {PLANS.map((plan) => {
                const price = planPriceCents(plan, cycle);
                return (
                  <article key={plan.id} className={`plan${plan.highlight ? " hl" : ""}`}>
                    {plan.highlight && <span className="badge-top">Mais escolhido</span>}
                    <h3>{plan.name}</h3>
                    <p className="tl">{plan.tagline}</p>
                    <div className="price">
                      <b>{money(cycle === "ANUAL" ? Math.round(price / 12) : price)}</b>
                      <span>/mês</span>
                    </div>
                    <p className="sub">
                      {cycle === "ANUAL" ? `${money(price)} por ano, em até ${ANNUAL_MAX_INSTALLMENTS}x no cartão ou Pix` : "Cobrado todo mês no cartão"}
                    </p>
                    <ul className="checks">
                      {plan.features.map((f) => (
                        <li key={f}>
                          <Icon name="check" className="ico sm" />
                          {f}
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

            <ul className="conds">
              <li>
                <Icon name="clock" className="ico sm" />
                Loja no ar em até {SETUP_BUSINESS_DAYS} dias úteis depois do pagamento e do envio do logo e das informações da loja.
              </li>
              <li>
                <Icon name="globe" className="ico sm" />
                Não tem domínio? Registramos para você por {money(DOMAIN_FEE_CENTS)} o primeiro ano.
              </li>
              <li>
                <Icon name="shield" className="ico sm" />
                Garantia de 7 dias: se desistir nesse prazo, devolvemos o valor pago.
              </li>
              <li>
                <Icon name="card" className="ico sm" />
                Pagamento seguro pelo Mercado Pago. Mensal no cartão; anual no Pix ou cartão parcelado.
              </li>
            </ul>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
