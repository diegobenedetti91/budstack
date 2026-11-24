import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { planNames } from "@/lib/plans";
import { dateBR, refundableInvoices } from "@/lib/billing";
import { STAGES, cycleLabel, dateTime, formatDocument, formatPhone, money, priceSuffix, whatsappUrl } from "@/lib/format";
import { sourceLabel } from "@/lib/tracking";
import { ActionForm } from "@/components/ActionForm";
import { DomainBadge, EVENT_LABEL, InvoiceBadge, StageBadge, StatusBadge } from "@/components/Badges";
import { adminCancelAction, reconcileAction, toggleUserBlockAction, updateStageAction } from "../../actions";

const MP_SUB_LABEL: Record<string, string> = { pending: "Aguardando autorização", authorized: "Ativa", paused: "Pausada", cancelled: "Cancelada" };

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await prisma.subscription.findUnique({
    where: { id },
    include: { user: true, invoices: { orderBy: { createdAt: "desc" } }, events: { orderBy: { createdAt: "desc" }, take: 50 } },
  });
  if (!s) notFound();
  const [names, refundable, others] = await Promise.all([
    planNames(),
    refundableInvoices(s),
    s.userId ? prisma.subscription.findMany({ where: { userId: s.userId, id: { not: s.id } }, select: { id: true, storeName: true, status: true, cancelAtPeriodEnd: true } }) : [],
  ]);
  const live = ["PENDING", "ACTIVE", "PAST_DUE"].includes(s.status);
  const paidTotal = s.invoices.filter((i) => i.status === "PAID").reduce((a, i) => a + i.amountCents, 0);

  return (
    <>
      <Link href="/admin/clientes" className="muted" style={{ fontSize: 14, fontWeight: 600 }}>
        ← Clientes
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
        <h1>{s.storeName}</h1>
        <StatusBadge sub={s} />
        <StageBadge stage={s.stage} />
      </div>
      <p className="page-sub">
        Pedido {s.code} · criado em {dateTime(s.createdAt)} · recebido até agora: {money(paidTotal)}
      </p>

      {s.status === "PAST_DUE" && <div className="note-box bad">Inadimplente: tolerância até {dateBR(s.graceUntil)}. Sem pagamento, a assinatura é encerrada e você recebe o aviso para suspender a loja.</div>}
      {s.cancelAtPeriodEnd && s.status === "ACTIVE" && <div className="note-box warn">Cancelamento agendado{s.cancelReason ? ` (${s.cancelReason})` : ""}: a loja fica no ar até {dateBR(s.currentPeriodEnd)}.</div>}

      <div className="detail">
        <div>
          <section className="card">
            <h2>Plano e cobrança</h2>
            <dl className="kv">
              <dt>Plano</dt>
              <dd>
                {names.get(s.plan) ?? s.plan} ({cycleLabel(s.cycle)}) · {money(s.planPriceCents)}
                {priceSuffix(s.cycle)}
              </dd>
              <dt>Período atual</dt>
              <dd>{s.currentPeriodStart ? `${dateBR(s.currentPeriodStart)} a ${dateBR(s.currentPeriodEnd)}` : "—"}</dd>
              <dt>1º pagamento</dt>
              <dd>{dateTime(s.paidAt)}</dd>
              {s.cycle === "MENSAL" && (
                <>
                  <dt>Assinatura no MP</dt>
                  <dd>{s.mpSubscriptionStatus ? (MP_SUB_LABEL[s.mpSubscriptionStatus] ?? s.mpSubscriptionStatus) : "—"}</dd>
                </>
              )}
              {s.endedAt && (
                <>
                  <dt>Encerrada em</dt>
                  <dd>
                    {dateTime(s.endedAt)} ({s.endedReason})
                  </dd>
                </>
              )}
              {s.cancelReason && (
                <>
                  <dt>Motivo do cancelamento</dt>
                  <dd>{s.cancelReason}</dd>
                </>
              )}
              <dt>Aviso de nova venda</dt>
              <dd>{s.notifiedAt ? dateTime(s.notifiedAt) : s.paidAt ? "Não enviado (confira SMTP/CallMeBot)" : "—"}</dd>
              <dt>Origem</dt>
              <dd>{s.source ? [sourceLabel(s.source), s.medium, s.campaign].filter(Boolean).join(" · ") : "—"}</dd>
            </dl>
            <ActionForm action={reconcileAction} style={{ marginTop: 18 }}>
              <input type="hidden" name="id" value={s.id} />
              <button className="btn btn-ghost btn-sm">Conferir no Mercado Pago</button>
            </ActionForm>
          </section>

          <section className="card">
            <h2>Pagamentos</h2>
            {s.invoices.length === 0 ? (
              <p className="muted">Nenhuma cobrança ainda.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="mini-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Tipo</th>
                      <th>Valor</th>
                      <th>Situação</th>
                      <th>MP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.invoices.map((i) => (
                      <tr key={i.id}>
                        <td>{dateBR(i.paidAt ?? i.dueDate)}</td>
                        <td>{i.kind === "DOMAIN" ? "Domínio" : i.domainCents ? "Plano + domínio" : "Plano"}</td>
                        <td>{money(i.amountCents)}</td>
                        <td>
                          <InvoiceBadge status={i.status} />
                          {i.failureReason && <small className="muted"> {i.failureReason}</small>}
                        </td>
                        <td>
                          <small>{i.mpPaymentId ?? "—"}</small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <h2>Domínio</h2>
            <dl className="kv">
              <dt>Domínio</dt>
              <dd>
                <b>{s.domain}</b>
              </dd>
              <dt>Situação</dt>
              <dd>
                <DomainBadge option={s.domainOption} paid={!!s.domainPaidAt} />
              </dd>
              {s.domainOption === "REGISTER" && (
                <>
                  <dt>Taxa</dt>
                  <dd>
                    {money(s.domainFeeCents)} · {s.domainPaidAt ? `paga em ${dateBR(s.domainPaidAt)}` : "pendente"}
                  </dd>
                </>
              )}
            </dl>
          </section>

          <section className="card">
            <h2>Histórico</h2>
            <ul style={{ display: "grid", gap: 6, fontSize: 14 }}>
              {s.events.map((e) => (
                <li key={e.id}>
                  <span className="muted">{dateTime(e.createdAt)}</span> · {EVENT_LABEL[e.kind] ?? e.kind}
                  {e.amountCents ? ` · ${money(Math.abs(e.amountCents))}` : ""}
                  {e.detail ? <span className="muted"> · {e.detail}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div>
          <section className="card">
            <h2>Cliente</h2>
            <dl className="kv">
              <dt>Nome</dt>
              <dd>{s.customerName}</dd>
              <dt>E-mail</dt>
              <dd>
                <a href={`mailto:${s.customerEmail}`} style={{ color: "var(--blue)" }}>
                  {s.customerEmail}
                </a>
              </dd>
              <dt>WhatsApp</dt>
              <dd>
                <a href={whatsappUrl(s.customerPhone, `Olá, ${s.customerName.split(" ")[0]}! Aqui é da BudStack, sobre a sua loja ${s.storeName}.`)} target="_blank" rel="noopener noreferrer" style={{ color: "var(--blue)" }}>
                  {formatPhone(s.customerPhone)}
                </a>
              </dd>
              <dt>CPF/CNPJ</dt>
              <dd>{formatDocument(s.customerDocument)}</dd>
              {s.user && (
                <>
                  <dt>Acesso</dt>
                  <dd>
                    {s.user.status === "BLOCKED" ? <span className="badge red">Bloqueado</span> : <span className="badge green">Liberado</span>} · último login {dateTime(s.user.lastLoginAt)}
                  </dd>
                </>
              )}
              {others.length > 0 && (
                <>
                  <dt>Outras lojas</dt>
                  <dd>
                    {others.map((o) => (
                      <Link key={o.id} href={`/admin/clientes/${o.id}`} style={{ color: "var(--blue)", display: "block" }}>
                        {o.storeName}
                      </Link>
                    ))}
                  </dd>
                </>
              )}
            </dl>
            {s.user && s.user.role !== "ADMIN" && (
              <ActionForm action={toggleUserBlockAction} confirm={s.user.status === "BLOCKED" ? "Liberar o acesso deste cliente?" : "Bloquear o acesso deste cliente à área de cliente?"} style={{ marginTop: 14 }}>
                <input type="hidden" name="userId" value={s.user.id} />
                <button className="btn btn-ghost btn-sm">{s.user.status === "BLOCKED" ? "Liberar acesso" : "Bloquear acesso"}</button>
              </ActionForm>
            )}
          </section>

          <section className="card">
            <h2>Implantação</h2>
            <ActionForm action={updateStageAction}>
              <input type="hidden" name="id" value={s.id} />
              <div className="field">
                <label htmlFor="stage">Etapa</label>
                <select id="stage" name="stage" defaultValue={s.stage}>
                  {STAGES.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="notes">Anotações</label>
                <textarea id="notes" name="notes" defaultValue={s.notes ?? ""} placeholder="Ex.: logo recebido, banco criado, DNS apontado…" />
              </div>
              <button className="btn btn-primary btn-block btn-sm">Salvar</button>
            </ActionForm>
          </section>

          {live && (
            <section className="card">
              <h2>Cancelar assinatura</h2>
              <ActionForm action={adminCancelAction} confirm="Cancelar esta assinatura? O cliente recebe um e-mail.">
                <input type="hidden" name="id" value={s.id} />
                <p className="muted" style={{ fontSize: 13.5, marginBottom: 12 }}>
                  {s.status === "ACTIVE" ? `Sem reembolso: a loja fica no ar até ${dateBR(s.currentPeriodEnd)} e nada mais é cobrado.` : "Encerra na hora, sem cobrar nada."}
                </p>
                {refundable.length > 0 && (
                  <label className="check-line" style={{ marginBottom: 12 }}>
                    <input type="checkbox" name="refund" />
                    <span>Estornar {money(refundable.reduce((a, i) => a + i.amountCents, 0))} e encerrar agora (dentro do prazo de arrependimento)</span>
                  </label>
                )}
                <button className="btn btn-danger btn-sm">Cancelar assinatura</button>
              </ActionForm>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
