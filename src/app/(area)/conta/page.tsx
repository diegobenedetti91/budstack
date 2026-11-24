import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { planNames } from "@/lib/plans";
import { dateBR, refundableInvoices } from "@/lib/billing";
import { cycleLabel, money, priceSuffix } from "@/lib/format";
import { CANCEL_REASONS } from "@/lib/cancel-reasons";
import { ActionForm } from "@/components/ActionForm";
import { EVENT_LABEL, InvoiceBadge, StatusBadge } from "@/components/Badges";
import { cancelAction, payAction, undoCancelAction } from "./actions";

export const metadata: Metadata = { title: "Minhas assinaturas" };

const ENDED: Record<string, string> = {
  refunded: "Cancelada com reembolso integral.",
  payment_failed: "Encerrada porque o pagamento não foi confirmado. Nada mais será cobrado.",
  not_paid: "O pagamento não foi concluído. Nada foi cobrado.",
  canceled: "Assinatura encerrada.",
};

export default async function ContaPage() {
  const user = await requireUser();
  const [subs, names, s] = await Promise.all([
    prisma.subscription.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { invoices: { orderBy: { createdAt: "desc" } }, events: { orderBy: { createdAt: "desc" }, take: 20 } },
    }),
    planNames(),
    getSettings(),
  ]);

  return (
    <>
      <h1>Minhas assinaturas</h1>
      <p className="page-sub">Seus planos, pagamentos e regras de cobrança, sem letras miúdas.</p>

      {subs.length === 0 && (
        <div className="sub-card" style={{ marginTop: 20, textAlign: "center" }}>
          <p className="muted">Você ainda não tem uma loja VirtualStore.</p>
          <Link href="/planos" className="btn btn-primary" style={{ marginTop: 14 }}>
            Ver planos
          </Link>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        {await Promise.all(
          subs.map(async (sub) => {
            const name = names.get(sub.plan) ?? sub.plan;
            const refundable = await refundableInvoices(sub);
            const refundUntil = sub.paidAt ? new Date(sub.paidAt.getTime() + s.refund_days * 864e5) : null;
            const renewal = sub.cycle === "ANUAL" && sub.status === "ACTIVE" ? sub.invoices.find((i) => i.kind === "PLAN" && i.status === "PENDING" && i.payUrl) : undefined;
            const domainDue = sub.domainOption === "REGISTER" && !sub.domainPaidAt && ["ACTIVE", "PAST_DUE"].includes(sub.status);
            const live = ["PENDING", "ACTIVE", "PAST_DUE"].includes(sub.status);

            const lines: string[] = [];
            if (sub.status === "PENDING") lines.push(`Aguardando o primeiro pagamento (${money(sub.totalCents)}).`);
            if (sub.status === "ACTIVE") {
              if (sub.cancelAtPeriodEnd) lines.push(`Cancelamento pedido: sua loja fica no ar até ${dateBR(sub.currentPeriodEnd)}. Nada mais será cobrado.`);
              else if (sub.cycle === "MENSAL") lines.push(`Renova em ${dateBR(sub.currentPeriodEnd)} por ${money(sub.planPriceCents)}, no cartão.`);
              else lines.push(`Vale até ${dateBR(sub.currentPeriodEnd)}. Você recebe o link da renovação ${s.renewal_notice_days} dias antes.`);
            }
            if (sub.status === "PAST_DUE")
              lines.push(`Não confirmamos o último pagamento. Sua loja continua no ar até ${dateBR(sub.graceUntil)}; sem pagamento, a assinatura é encerrada sem multa e sem juros.`);
            if (!live) lines.push(ENDED[sub.endedReason ?? "canceled"] ?? ENDED.canceled);

            return (
              <article key={sub.id} className="sub-card">
                <div className="sub-head">
                  <div>
                    <h2>
                      {sub.storeName} <StatusBadge sub={sub} />
                    </h2>
                    <div className="sub-lines">
                      <span>
                        Plano <b>{name}</b> ({cycleLabel(sub.cycle)}) · {money(sub.planPriceCents)}
                        {priceSuffix(sub.cycle)} · domínio {sub.domain} · pedido {sub.code}
                      </span>
                      {lines.map((l) => (
                        <span key={l}>{l}</span>
                      ))}
                    </div>
                  </div>
                  <div className="sub-actions">
                    {(sub.status === "PENDING" || sub.status === "PAST_DUE" || renewal) && !(sub.status === "PAST_DUE" && sub.cycle === "MENSAL") && (
                      <ActionForm action={payAction}>
                        <input type="hidden" name="id" value={sub.id} />
                        <input type="hidden" name="what" value="open" />
                        <button className="btn btn-primary btn-sm">{sub.status === "PENDING" ? "Concluir pagamento" : sub.status === "PAST_DUE" ? "Regularizar pagamento" : `Pagar renovação · ${money(renewal!.amountCents)}`}</button>
                      </ActionForm>
                    )}
                    {domainDue && (
                      <ActionForm action={payAction}>
                        <input type="hidden" name="id" value={sub.id} />
                        <input type="hidden" name="what" value="domain" />
                        <button className="btn btn-ghost btn-sm">Pagar registro do domínio · {money(sub.domainFeeCents)}</button>
                      </ActionForm>
                    )}
                    {sub.status === "ACTIVE" && sub.cancelAtPeriodEnd && (
                      <ActionForm action={undoCancelAction}>
                        <input type="hidden" name="id" value={sub.id} />
                        <button className="btn btn-ghost btn-sm">Desfazer cancelamento</button>
                      </ActionForm>
                    )}
                  </div>
                </div>

                {sub.status === "PAST_DUE" && sub.cycle === "MENSAL" && (
                  <div className="note-box bad">O Mercado Pago vai tentar a cobrança de novo. Confira o limite do cartão ou atualize-o na sua conta do Mercado Pago.</div>
                )}
                {refundable.length > 0 && !sub.cancelAtPeriodEnd && (
                  <div className="note-box info">Arrependeu-se? Até {dateBR(refundUntil)} você pode cancelar com reembolso integral.</div>
                )}

                {live && !(sub.status === "ACTIVE" && sub.cancelAtPeriodEnd) && (
                  <details className="inline">
                    <summary>{sub.status === "PENDING" ? "Cancelar pedido" : "Cancelar assinatura"}</summary>
                    <ActionForm action={cancelAction} confirm="Confirmar o cancelamento?" style={{ marginTop: 12, maxWidth: 520 }}>
                      <input type="hidden" name="id" value={sub.id} />
                      <p className="muted" style={{ fontSize: 14, marginBottom: 12 }}>
                        {sub.status === "ACTIVE"
                          ? `Sem multa. Sua loja continua no ar até ${dateBR(sub.currentPeriodEnd)} e nada mais será cobrado. Dá para desfazer até lá.`
                          : "Sem multa. A assinatura é encerrada na hora e nada será cobrado."}
                      </p>
                      <div className="field">
                        <label htmlFor={`reason-${sub.id}`}>Pode nos contar o motivo? (opcional)</label>
                        <select id={`reason-${sub.id}`} name="reason" defaultValue="">
                          <option value="">Prefiro não dizer</option>
                          {CANCEL_REASONS.map((r) => (
                            <option key={r}>{r}</option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <input name="other" placeholder="Algo mais que queira contar (opcional)" maxLength={200} aria-label="Detalhe do motivo" />
                      </div>
                      {refundable.length > 0 && (
                        <label className="check-line" style={{ marginBottom: 14 }}>
                          <input type="checkbox" name="refund" />
                          <span>
                            Quero o reembolso integral de {money(refundable.reduce((a, i) => a + i.amountCents, 0))} (direito de arrependimento). A assinatura é encerrada na hora.
                          </span>
                        </label>
                      )}
                      <button className="btn btn-danger btn-sm">Confirmar cancelamento</button>
                    </ActionForm>
                  </details>
                )}

                {sub.invoices.length > 0 && (
                  <details className="inline">
                    <summary>Pagamentos ({sub.invoices.length})</summary>
                    <div style={{ overflowX: "auto" }}>
                      <table className="mini-table">
                        <thead>
                          <tr>
                            <th>Data</th>
                            <th>Descrição</th>
                            <th>Valor</th>
                            <th>Situação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sub.invoices.map((i) => (
                            <tr key={i.id}>
                              <td>{dateBR(i.paidAt ?? i.dueDate)}</td>
                              <td>{i.kind === "DOMAIN" ? "Registro de domínio" : i.periodEnd ? `Plano até ${dateBR(i.periodEnd)}` : "Plano"}</td>
                              <td>{money(i.amountCents)}</td>
                              <td>
                                <InvoiceBadge status={i.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}

                {sub.events.length > 0 && (
                  <details className="inline">
                    <summary>Histórico</summary>
                    <ul style={{ marginTop: 10, display: "grid", gap: 6, fontSize: 13.5 }}>
                      {sub.events.map((e) => (
                        <li key={e.id}>
                          <span className="muted">{dateBR(e.createdAt)}</span> · {EVENT_LABEL[e.kind] ?? e.kind}
                          {e.amountCents ? ` · ${money(Math.abs(e.amountCents))}` : ""}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </article>
            );
          }),
        )}
      </div>

      <div className="sub-card" style={{ marginTop: 16 }}>
        <b>Regras da assinatura</b>
        <ul className="checks" style={{ marginTop: 10 }}>
          <li>Cancele quando quiser, sem multa: a loja fica no ar até o fim do período pago.</li>
          <li>Até {s.refund_days} dias depois do primeiro pagamento, o cancelamento tem reembolso integral.</li>
          <li>Pagamento não confirmado: {s.grace_days} dias de tolerância com a loja no ar. Depois, a assinatura é encerrada sem multa e sem juros.</li>
        </ul>
      </div>
    </>
  );
}
