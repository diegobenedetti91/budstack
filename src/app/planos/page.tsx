import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Faq, HelpBox } from "@/components/Faq";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { PlanCards } from "@/components/marketing/PlanCards";
import { MarketingEffects } from "@/components/marketing/MarketingEffects";
import { getPlans, type Cycle } from "@/lib/plans";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import { money, whatsappUrl } from "@/lib/format";

export const metadata: Metadata = {
  title: "Planos da VirtualStore",
  description: "Escolha o plano da sua loja virtual VirtualStore: mensal no cartão ou anual com desconto.",
};
export const dynamic = "force-dynamic";

export default async function PlanosPage({ searchParams }: { searchParams: Promise<{ ciclo?: string }> }) {
  const { ciclo } = await searchParams;
  const cycle: Cycle = ciclo === "anual" ? "ANUAL" : "MENSAL";
  const [plans, s, allFeatures] = await Promise.all([getPlans({ activeOnly: true }), getSettings(), prisma.feature.findMany({ where: { active: true }, orderBy: { sort: "asc" } })]);
  const freeMonths = 12 - s.annual_months_charged;
  const included = new Set(plans.flatMap((p) => p.features.map((f) => f.id)));
  const compare = allFeatures.filter((f) => included.has(f.id));
  const wa = whatsappUrl(s.contact_whatsapp, "Olá! Estou vendo os planos da VirtualStore e tenho uma dúvida.");

  return (
    <>
      <SiteHeader />
      <main className="mk">
        <section id="planos" className="mk-dark mk-sec" style={{ paddingTop: "clamp(40px, 6vw, 80px)" }}>
          <span className="mk-glow a" />
          <span className="mk-glow b" />
          <span className="mk-grid-bg" />
          <div className="mk-wrap">
            <div className="mk-head">
              <span className="mk-kicker">Planos VirtualStore</span>
              <h2 style={{ fontSize: "clamp(32px, 6vw, 58px)" }}>
                Escolha o plano da <span className="mk-grad-text">sua loja</span>
              </h2>
              <p>Implantação inclusa em todos os planos. Cancele quando quiser, sem multa.</p>
              <div className="mk-toggle" role="tablist" aria-label="Ciclo de cobrança">
                <Link href="/planos" className={cycle === "MENSAL" ? "on" : ""} role="tab" aria-selected={cycle === "MENSAL"} scroll={false}>
                  Mensal
                </Link>
                <Link href="/planos?ciclo=anual" className={cycle === "ANUAL" ? "on" : ""} role="tab" aria-selected={cycle === "ANUAL"} scroll={false}>
                  Anual {freeMonths > 0 && <em>{freeMonths === 1 ? "1 mês grátis" : `${freeMonths} meses grátis`}</em>}
                </Link>
              </div>
            </div>

            {plans.length === 0 ? <p style={{ textAlign: "center" }}>Nenhum plano disponível no momento. Fale com a gente pelo WhatsApp.</p> : <PlanCards plans={plans} cycle={cycle} s={s} />}

            <ul className="mk-conds">
              <li>
                <Icon name="clock" className="ico" /> No ar em até {s.setup_business_days} dias úteis após o envio da sua marca.
              </li>
              <li>
                <Icon name="globe" className="ico" /> Sem domínio? Registramos por {money(s.domain_fee_cents)} o 1º ano.
              </li>
              <li>
                <Icon name="shield" className="ico" /> Reembolso integral em até {s.refund_days} dias.
              </li>
              <li>
                <Icon name="pause" className="ico" /> Pause até {s.pause_max_months} {s.pause_max_months === 1 ? "mês" : "meses"} sem cobrança.
              </li>
            </ul>

            {plans.length > 1 && compare.length > 0 && (
              <div className="mk-compare mk-reveal">
                <h3>Compare os planos</h3>
                <div className="mk-compare-wrap">
                  <table>
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
                                <span aria-label="Não incluso">—</span>
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
          </div>
        </section>

        <section className="mk-sec">
          <div className="mk-wrap">
            <div className="mk-head mk-reveal">
              <span className="mk-kicker">Dúvidas</span>
              <h2>Perguntas frequentes</h2>
            </div>
            <Faq s={s} />
            <div style={{ maxWidth: 820, margin: "24px auto 0" }}>
              <HelpBox whatsapp={wa} />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
      <MarketingEffects whatsapp={wa} cta={{ href: "#planos", label: "Escolher meu plano" }} />
    </>
  );
}
