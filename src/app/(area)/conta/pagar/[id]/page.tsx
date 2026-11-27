import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { planNames } from "@/lib/plans";
import { dateBR } from "@/lib/billing";
import { cycleLabel, money } from "@/lib/format";
import { ActionForm } from "@/components/ActionForm";
import { Icon } from "@/components/Icon";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { payMockAction } from "../../actions";

export const metadata: Metadata = { title: "Pagamento (simulação)" };

export default async function PagarSimuladoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const inv = await prisma.invoice.findUnique({ where: { id }, include: { subscription: true } });
  if (!inv || inv.subscription.userId !== user.id || inv.subscription.provider !== "SIMULADO") notFound();
  const sub = inv.subscription;
  const name = (await planNames()).get(sub.plan) ?? sub.plan;
  const open = inv.status === "PENDING" || inv.status === "FAILED";

  return (
    <>
      <div className="test-banner" style={{ borderRadius: 12, marginBottom: 16 }}>
        <Icon name="alert" className="ico sm" /> Ambiente de teste: o pagamento é simulado e nenhum valor é cobrado.
      </div>
      <PageHeader title="Pagamento" subtitle={`${sub.storeName} · pedido ${sub.code}`} />
      <div className="ui-grid-2">
        <Card>
          <CardHeader title={inv.kind === "DOMAIN" ? "Registro de domínio" : `VirtualStore ${name} (${cycleLabel(sub.cycle)})`} subtitle={`Vencimento ${dateBR(inv.dueDate)}`} icon="receipt" />
          <div className="ui-card-body">
            <p style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em" }}>{money(inv.amountCents)}</p>
            {inv.status === "FAILED" && <p className="ui-msg bad">{inv.failureReason ?? "O último pagamento foi recusado."}</p>}
            {inv.status === "PAID" && (
              <p style={{ marginTop: 8 }}>
                <Badge tone="good" dot>
                  Paga
                </Badge>
              </p>
            )}
            {open ? (
              <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
                {[
                  ["pix", "Pagar com Pix (aprovado)", "primary"],
                  ["card_ok", "Cartão de crédito (aprovado)", "secondary"],
                  ["card_fail", "Cartão de crédito (recusado)", "quiet"],
                ].map(([outcome, label, tone]) => (
                  <ActionForm key={outcome} action={payMockAction}>
                    <input type="hidden" name="id" value={inv.id} />
                    <input type="hidden" name="outcome" value={outcome} />
                    <button className={`ui-btn ${tone} block lg`}>{label}</button>
                  </ActionForm>
                ))}
              </div>
            ) : (
              <Link href="/conta" className="ui-btn secondary" style={{ marginTop: 16 }}>
                Voltar para a assinatura
              </Link>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Como funciona a simulação" icon="shield" />
          <ul className="rules">
            <li>
              <b>Pix e cartão aprovado</b> confirmam o pagamento na hora, como o gateway faria.
            </li>
            <li>
              <b>Cartão recusado</b> mostra o fluxo de pagamento não confirmado (e, numa renovação, a tolerância de atraso).
            </li>
            <li>Os avisos para você e os e-mails ao cliente saem normalmente.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
