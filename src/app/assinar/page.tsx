import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { Icon } from "@/components/Icon";
import { ANNUAL_MAX_INSTALLMENTS, DOMAIN_FEE_CENTS, getPlan, planPriceCents, type Cycle } from "@/lib/plans";
import { money } from "@/lib/format";
import { CheckoutForm } from "./CheckoutForm";

export const metadata: Metadata = { title: "Assinar a VirtualStore", robots: { index: false } };

export default async function AssinarPage({ searchParams }: { searchParams: Promise<{ plano?: string; ciclo?: string }> }) {
  const sp = await searchParams;
  const plan = getPlan(sp.plano);
  if (!plan) redirect("/planos");
  const ciclo = sp.ciclo === "anual" ? "anual" : "mensal";
  const cycle: Cycle = ciclo === "anual" ? "ANUAL" : "MENSAL";
  const price = planPriceCents(plan, cycle);
  const other = ciclo === "anual" ? "mensal" : "anual";

  return (
    <>
      <SiteHeader />
      <main className="sec soft">
        <div className="wrap">
          <div className="sec-head" style={{ marginBottom: 32 }}>
            <span className="kicker">Assinatura</span>
            <h1>Falta pouco para a sua loja</h1>
          </div>
          <div className="checkout">
            <CheckoutForm plano={plan.id} ciclo={ciclo} domainFee={money(DOMAIN_FEE_CENTS)} />

            <aside className="card summary">
              <h2>Resumo</h2>
              <div className="row">
                <span>Plano</span>
                <b>VirtualStore {plan.name}</b>
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
                {ciclo === "anual"
                  ? `Pix ou cartão em até ${ANNUAL_MAX_INSTALLMENTS}x. Se a BudStack registrar o seu domínio, a taxa de ${money(DOMAIN_FEE_CENTS)} entra neste pagamento.`
                  : `Cobrança automática no cartão todo mês. Se a BudStack registrar o seu domínio, a taxa de ${money(DOMAIN_FEE_CENTS)} é paga à parte, logo depois da assinatura.`}
              </p>
              <ul className="checks" style={{ marginTop: 18 }}>
                <li>
                  <Icon name="shield" className="ico sm" /> Garantia de 7 dias
                </li>
                <li>
                  <Icon name="lock" className="ico sm" /> Pagamento pelo Mercado Pago
                </li>
                <li>
                  <Icon name="users" className="ico sm" /> Implantação inclusa
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
