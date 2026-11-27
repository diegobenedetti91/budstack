import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { Icon } from "@/components/Icon";
import { getPlan, planPriceCents, type Cycle } from "@/lib/plans";
import { getSettings } from "@/lib/settings";
import { currentUser } from "@/lib/auth";
import { formatDocument, formatPhone, money } from "@/lib/format";
import { CheckoutForm } from "./CheckoutForm";
import { GATEWAY_NAME, checkoutNote, gatewayOf, termsBilling } from "@/lib/billing-copy";

export const metadata: Metadata = { title: "Assinar a VirtualStore", robots: { index: false } };

export default async function AssinarPage({ searchParams }: { searchParams: Promise<{ plano?: string; ciclo?: string }> }) {
  const sp = await searchParams;
  const [plan, s, user] = await Promise.all([getPlan(sp.plano, { activeOnly: true }), getSettings(), currentUser()]);
  if (!plan) redirect("/planos");
  const ciclo = sp.ciclo === "anual" ? "anual" : "mensal";
  const cycle: Cycle = ciclo === "anual" ? "ANUAL" : "MENSAL";
  const price = planPriceCents(plan, cycle, s);
  const other = ciclo === "anual" ? "mensal" : "anual";
  const g = gatewayOf(s);

  return (
    <>
      <SiteHeader />
      {g === "SIMULADO" && <div className="test-banner">Ambiente de teste: o pagamento é simulado e nenhum valor é cobrado.</div>}
      <main className="sec soft">
        <div className="wrap">
          <div className="sec-head" style={{ marginBottom: 24 }}>
            <span className="kicker">Assinatura</span>
            <h1>Falta pouco para a sua loja</h1>
          </div>
          <ol className="steps-bar" aria-label="Etapas da assinatura">
            <li className="done">
              <span>
                <Icon name="check" className="ico sm" />
              </span>
              Plano
            </li>
            <li className="current" aria-current="step">
              <span>2</span>
              {user ? "Seus dados" : "Conta e dados"}
            </li>
            <li>
              <span>3</span>
              Pagamento
            </li>
          </ol>
          <div className="checkout">
            <CheckoutForm
              plano={plan.id}
              ciclo={ciclo}
              domainFee={money(s.domain_fee_cents)}
              setupDays={s.setup_business_days}
              refundDays={s.refund_days}
              gateway={{ name: GATEWAY_NAME[g], mpEmailHint: g === "MERCADOPAGO" && ciclo === "mensal", terms: termsBilling(g, cycle) }}
              user={user ? { name: user.name, email: user.email, phone: user.phone ? formatPhone(user.phone) : "", document: user.document ? formatDocument(user.document) : "" } : null}
            />

            <aside className="card summary">
              <h2>Resumo</h2>
              <div className="row">
                <span>Plano</span>
                <span>
                  <b>VirtualStore {plan.name}</b> ·{" "}
                  <Link href={`/planos${ciclo === "anual" ? "?ciclo=anual" : ""}`} style={{ color: "var(--blue)", fontWeight: 700 }}>
                    trocar
                  </Link>
                </span>
              </div>
              <div className="row">
                <span>Cobrança</span>
                <span>
                  {ciclo === "anual" ? "Anual" : "Mensal"} ·{" "}
                  <Link href={`/assinar?plano=${plan.id}&ciclo=${other}`} style={{ color: "var(--blue)", fontWeight: 700 }}>
                    mudar para {other}
                  </Link>
                </span>
              </div>
              <div className="row total">
                <span>{ciclo === "anual" ? "Total por ano" : "Por mês"}</span>
                <span>{money(price)}</span>
              </div>
              <p className="note">
                {checkoutNote(g, cycle, s)}
              </p>
              {plan.features.length > 0 && (
                <details className="summary-features">
                  <summary>O que o {plan.name} inclui ({plan.features.length})</summary>
                  <ul className="checks" style={{ marginTop: 10 }}>
                    {plan.features.map((f) => (
                      <li key={f.id}>
                        <Icon name="check" className="ico sm" /> {f.name}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <ul className="checks" style={{ marginTop: 18 }}>
                <li>
                  <Icon name="shield" className="ico sm" /> Reembolso integral em até {s.refund_days} dias
                </li>
                <li>
                  <Icon name="lock" className="ico sm" /> Pagamento pelo {GATEWAY_NAME[g]}
                </li>
                <li>
                  <Icon name="users" className="ico sm" /> Cancele quando quiser, sem multa
                </li>
              </ul>
            </aside>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
