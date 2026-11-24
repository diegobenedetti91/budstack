import type { Metadata } from "next";
import Link from "next/link";
import type { Invoice, Subscription, SubscriptionEvent } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import type { Settings } from "@/lib/settings-schema";
import { getPlans, planPriceCents, type Cycle, type PlanView } from "@/lib/plans";
import { addMonths, dateBR, refundableInvoices } from "@/lib/billing";
import { cycleLabel, money, priceSuffix } from "@/lib/format";
import { CANCEL_REASONS } from "@/lib/cancel-reasons";
import { ActionForm } from "@/components/ActionForm";
import { ConfirmForm } from "@/components/ConfirmForm";
import { Icon } from "@/components/Icon";
import { EVENT_LABEL } from "@/components/Badges";
import { Badge, Card, CardHeader, EmptyState, PageHeader, type Tone } from "@/components/ui";
import { cancelAction, changePlanAction, pauseAction, payAction, resumeAction, undoCancelAction } from "./actions";

export const metadata: Metadata = { title: "Assinatura" };

type Sub = Subscription & { invoices: Invoice[]; events: SubscriptionEvent[] };

const INVOICE: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: "a pagar", tone: "warn" },
  PAID: { label: "paga", tone: "good" },
  FAILED: { label: "recusada", tone: "bad" },
  REFUNDED: { label: "estornada", tone: "info" },
  CANCELED: { label: "cancelada", tone: "neutral" },
};

function badgeOf(sub: Sub): { label: string; tone: Tone } {
  if (sub.status === "PENDING") return { label: "Aguardando pagamento", tone: "warn" };
  if (sub.status === "PAST_DUE") return { label: "Pagamento pendente", tone: "bad" };
  if (sub.status === "PAUSED") return { label: "Pausada", tone: "neutral" };
  if (sub.status === "ACTIVE") return sub.cancelAtPeriodEnd ? { label: "Cancelada", tone: "warn" } : sub.pauseFrom ? { label: "Pausa agendada", tone: "info" } : { label: "Ativa", tone: "good" };
  if (sub.status === "EXPIRED") return { label: "Encerrada", tone: "neutral" };
  return { label: "Cancelada", tone: "neutral" };
}

export default async function ContaPage() {
  const user = await requireUser();
  const [subs, plans, s] = await Promise.all([
    prisma.subscription.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { invoices: { orderBy: { createdAt: "desc" } }, events: { orderBy: { createdAt: "desc" }, take: 12 } },
    }),
    getPlans(),
    getSettings(),
  ]);
  const names = new Map(plans.map((p) => [p.id, p.name]));

  return (
    <>
      <PageHeader
        title={subs.length > 1 ? "Minhas assinaturas" : "Assinatura"}
        subtitle="Seu plano, pagamentos e regras de cobrança, sem letras miúdas."
        action={
          <Link href="/planos" className="ui-btn secondary sm">
            <Icon name="layers" className="ico sm" /> Ver planos
          </Link>
        }
      />

      {subs.length === 0 && (
        <Card>
          <EmptyState
            icon="store"
            title="Você ainda não tem uma loja VirtualStore"
            text="Escolha um plano para colocar a sua marca no ar. A implantação está inclusa."
            action={
              <Link href="/planos" className="ui-btn primary">
                Ver planos
              </Link>
            }
          />
        </Card>
      )}

      <div className="ui-stack">
        {await Promise.all(subs.map(async (sub) => <SubscriptionBlock key={sub.id} sub={sub} plans={plans.filter((p) => p.active)} names={names} s={s} refundable={await refundableInvoices(sub)} multi={subs.length > 1} />))}
      </div>

      {subs.length > 0 && (
        <Card style={{ marginTop: 16 }}>
          <CardHeader title="Como funciona a cobrança" icon="shield" />
          <ul className="rules">
            {[
              ["Sem fidelidade", "Cancele quando quiser, sem multa. A loja segue no ar até o fim do período pago."],
              ["Arrependimento", `Até ${s.refund_days} dias após o primeiro pagamento, o cancelamento tem reembolso integral (CDC, art. 49).`],
              ["Pausa", `De 1 a ${s.pause_max_months} ${s.pause_max_months === 1 ? "mês" : "meses"}, sem cobrança, começando no fim do período pago. Volta sozinha (ou antes, se você quiser).${s.pause_cooldown_months ? ` Uma pausa a cada ${s.pause_cooldown_months} meses.` : ""}`],
              ["Troca de plano", "Vale a partir da próxima renovação, sem cobrança dupla."],
              ["Se o pagamento falhar", `Você tem ${s.grace_days} dias para pagar, com a loja no ar e avisos por e-mail. Sem pagamento, a assinatura é encerrada: sem multa e sem juros.`],
            ].map(([t, d]) => (
              <li key={t}>
                <b>{t}.</b> {d}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function SubscriptionBlock({ sub, plans, names, s, refundable, multi }: { sub: Sub; plans: PlanView[]; names: Map<string, string>; s: Settings; refundable: Invoice[]; multi: boolean }) {
  const name = names.get(sub.plan) ?? sub.plan;
  const nextName = sub.nextPlan ? (names.get(sub.nextPlan) ?? sub.nextPlan) : null;
  const badge = badgeOf(sub);
  const live = ["PENDING", "ACTIVE", "PAUSED", "PAST_DUE"].includes(sub.status);
  const per = priceSuffix(sub.cycle);
  const renewal = sub.invoices.find((i) => i.kind === "PLAN" && i.status === "PENDING" && i.payUrl);
  const domainDue = sub.domainOption === "REGISTER" && !sub.domainPaidAt && ["ACTIVE", "PAST_DUE", "PAUSED"].includes(sub.status);
  const refundTotal = refundable.reduce((a, i) => a + i.amountCents, 0);
  const refundUntil = sub.paidAt ? new Date(sub.paidAt.getTime() + s.refund_days * 864e5) : null;
  const nextPauseAt = s.pause_cooldown_months && sub.lastPauseAt ? addMonths(sub.lastPauseAt, s.pause_cooldown_months) : null;
  const cooling = !!nextPauseAt && nextPauseAt > new Date();
  const canPause = sub.status === "ACTIVE" && !sub.cancelAtPeriodEnd && !sub.pauseFrom && !cooling;
  const hidden = { id: sub.id };

  const lines: string[] = [];
  if (sub.status === "PENDING") lines.push(`Aguardando o primeiro pagamento (${money(sub.totalCents)}). A assinatura começa assim que ele for confirmado.`);
  if (sub.status === "ACTIVE") {
    if (sub.cancelAtPeriodEnd) lines.push(`Sua loja fica no ar até ${dateBR(sub.currentPeriodEnd)}. Nenhuma nova cobrança será feita.`);
    else if (sub.pauseFrom) lines.push(`Pausa agendada de ${dateBR(sub.pauseFrom)} a ${dateBR(sub.pauseUntil)}, sem cobrança.`);
    else if (sub.cycle === "MENSAL") lines.push(`Renova em ${dateBR(sub.currentPeriodEnd)} por ${money(sub.nextPlanPriceCents ?? sub.planPriceCents)} no cartão${nextName ? ` (passa para o plano ${nextName})` : ""}.`);
    else lines.push(`Vale até ${dateBR(sub.currentPeriodEnd)}. O link da renovação chega ${s.renewal_notice_days} dias antes${nextName ? `, já no plano ${nextName}` : ""}.`);
  }
  if (sub.status === "PAUSED") lines.push(`Pausada até ${dateBR(sub.pauseUntil)}, quando volta sozinha. Nenhuma cobrança nesse período.`);
  if (sub.status === "PAST_DUE") lines.push("Não confirmamos o último pagamento.");
  if (!live)
    lines.push(
      sub.endedReason === "payment_failed"
        ? "Encerrada porque o pagamento não foi confirmado. Nada mais será cobrado."
        : sub.endedReason === "refunded"
          ? "Cancelada com reembolso integral."
          : sub.endedReason === "not_paid"
            ? "O pagamento não foi concluído. Nada foi cobrado."
            : "Assinatura encerrada.",
    );

  const chipTone = sub.status === "PAST_DUE" ? "bad" : sub.status === "ACTIVE" && !sub.cancelAtPeriodEnd ? "" : sub.status === "PENDING" ? "warn" : "neutral";

  return (
    <div className="ui-stack">
      {/* Situação atual */}
      <Card>
        <div className="sub-hero">
          <div className="sub-hero-main">
            <span className={`ui-chip ${chipTone}`}>
              <Icon name="store" />
            </span>
            <div style={{ minWidth: 0 }}>
              <h2>
                {sub.storeName}
                <Badge tone={badge.tone} dot>
                  {badge.label}
                </Badge>
              </h2>
              <div className="lines">
                <span>
                  Plano <b>{name}</b> ({cycleLabel(sub.cycle)}) · {money(sub.planPriceCents)}
                  {per} · {sub.domain}
                  {multi ? ` · ${sub.code}` : ""}
                </span>
                {lines.map((l) => (
                  <span key={l}>{l}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="sub-hero-actions">
            {(sub.status === "PENDING" || (sub.status === "PAST_DUE" && sub.cycle === "ANUAL") || renewal) && (
              <ActionForm action={payAction}>
                <input type="hidden" name="id" value={sub.id} />
                <input type="hidden" name="what" value="open" />
                <button className="ui-btn primary">
                  <Icon name="card" className="ico sm" />
                  {sub.status === "PENDING" ? "Concluir pagamento" : sub.status === "PAST_DUE" ? "Regularizar pagamento" : `Pagar renovação · ${money(renewal!.amountCents)}`}
                </button>
              </ActionForm>
            )}
            {sub.status === "PAUSED" && (
              <ActionForm action={resumeAction}>
                <input type="hidden" name="id" value={sub.id} />
                <button className="ui-btn primary">
                  <Icon name="play" className="ico sm" /> Retomar agora
                </button>
              </ActionForm>
            )}
            {sub.status === "ACTIVE" && sub.cancelAtPeriodEnd && (
              <ActionForm action={undoCancelAction}>
                <input type="hidden" name="id" value={sub.id} />
                <button className="ui-btn secondary">
                  <Icon name="undo" className="ico sm" /> Desfazer cancelamento
                </button>
              </ActionForm>
            )}
            {domainDue && (
              <ActionForm action={payAction}>
                <input type="hidden" name="id" value={sub.id} />
                <input type="hidden" name="what" value="domain" />
                <button className="ui-btn secondary">
                  <Icon name="globe" className="ico sm" /> Pagar domínio · {money(sub.domainFeeCents)}
                </button>
              </ActionForm>
            )}
            {sub.status === "PENDING" && (
              <ConfirmForm
                action={cancelAction}
                hidden={hidden}
                trigger="Cancelar pedido"
                triggerClass="ui-btn quiet"
                title="Cancelar este pedido?"
                description="O pedido é encerrado e nada será cobrado."
                confirmText="Cancelar pedido"
                tone="danger"
              />
            )}
          </div>
        </div>
        {sub.status === "PAST_DUE" && (
          <div className="sub-alert bad">
            <Icon name="alert" className="ico sm" />
            <span>
              Pague até {dateBR(sub.graceUntil)} para manter a loja no ar.{" "}
              {sub.cycle === "MENSAL" ? "O Mercado Pago tenta a cobrança de novo; confira o limite do cartão ou atualize-o na sua conta do Mercado Pago. " : ""}
              Sem pagamento, a assinatura é encerrada: sem multa, sem juros e sem nenhuma cobrança.
            </span>
          </div>
        )}
        {nextName && sub.status === "ACTIVE" && !sub.cancelAtPeriodEnd && (
          <div className="sub-alert info">
            <Icon name="swap" className="ico sm" />
            <span>
              Troca agendada: a partir de {dateBR(sub.pauseUntil ?? sub.currentPeriodEnd)} você passa para o plano <b>{nextName}</b> ({money(sub.nextPlanPriceCents ?? 0)}
              {per}).
            </span>
          </div>
        )}
        {refundable.length > 0 && !sub.cancelAtPeriodEnd && (
          <div className="sub-alert info">
            <Icon name="shield" className="ico sm" />
            <span>Arrependeu-se? Até {dateBR(refundUntil)} você pode cancelar com reembolso integral de {money(refundTotal)}.</span>
          </div>
        )}
      </Card>

      {/* Gerenciar */}
      {live && sub.status !== "PENDING" && (
        <div className="ui-grid-3">
          <Card className="manage">
            <div className="ui-card-body">
              <h4>
                <Icon name="pause" className="ico sm" /> Pausar
              </h4>
              {canPause ? (
                <>
                  <p>
                    Precisa dar um tempo? Pause de 1 a {s.pause_max_months} {s.pause_max_months === 1 ? "mês" : "meses"} a partir de {dateBR(sub.currentPeriodEnd)}. Sem cobrança na pausa; volta sozinha.
                  </p>
                  <ActionForm action={pauseAction}>
                    <input type="hidden" name="id" value={sub.id} />
                    <div className="row-actions">
                      <div className="ui-seg" role="radiogroup" aria-label="Duração da pausa">
                        {Array.from({ length: s.pause_max_months }, (_, i) => i + 1).map((m) => (
                          <label key={m}>
                            <input type="radio" name="months" value={m} defaultChecked={m === 1} />
                            <span>
                              {m} {m === 1 ? "mês" : "meses"}
                            </span>
                          </label>
                        ))}
                      </div>
                      <button className="ui-btn secondary sm">Pausar assinatura</button>
                    </div>
                  </ActionForm>
                </>
              ) : sub.status === "ACTIVE" && sub.pauseFrom ? (
                <>
                  <p>
                    Pausa agendada de {dateBR(sub.pauseFrom)} a {dateBR(sub.pauseUntil)}.
                  </p>
                  <ActionForm action={resumeAction}>
                    <input type="hidden" name="id" value={sub.id} />
                    <div className="row-actions">
                      <button className="ui-btn secondary sm">Cancelar a pausa</button>
                    </div>
                  </ActionForm>
                </>
              ) : (
                <p>
                  {sub.status === "PAUSED"
                    ? `Pausada até ${dateBR(sub.pauseUntil)}. Use "Retomar agora" para voltar antes.`
                    : sub.status === "PAST_DUE"
                      ? "Regularize o pagamento para poder pausar."
                      : sub.cancelAtPeriodEnd
                        ? "Indisponível com o cancelamento agendado."
                        : cooling
                          ? `Você pode pausar de novo a partir de ${dateBR(nextPauseAt)}.`
                          : "Indisponível no momento."}
                </p>
              )}
            </div>
          </Card>

          <Card className="manage">
            <div className="ui-card-body">
              <h4>
                <Icon name="swap" className="ico sm" /> Trocar de plano
              </h4>
              {sub.status === "ACTIVE" && !sub.cancelAtPeriodEnd ? (
                <>
                  <p>A troca vale a partir da próxima renovação ({dateBR(sub.pauseUntil ?? sub.currentPeriodEnd)}), sem cobrança dupla.</p>
                  <div className="plan-pick">
                    {plans.map((p) => {
                      const target = sub.nextPlan ?? sub.plan;
                      if (p.id === target)
                        return (
                          <span key={p.id} className="current">
                            <Icon name="check" className="ico xs" /> {p.name}
                          </span>
                        );
                      return (
                        <ActionForm key={p.id} action={changePlanAction}>
                          <input type="hidden" name="id" value={sub.id} />
                          <input type="hidden" name="plan" value={p.id} />
                          <button className="ui-btn secondary sm" title={`${money(planPriceCents(p, sub.cycle as Cycle, s))}${per}`}>
                            {p.id === sub.plan ? `Manter ${p.name}` : `Mudar para ${p.name}`}
                          </button>
                        </ActionForm>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p>Disponível com a assinatura ativa.</p>
              )}
            </div>
          </Card>

          <Card className="manage">
            <div className="ui-card-body">
              <h4>
                <Icon name="xcircle" className="ico sm" /> Cancelar
              </h4>
              {sub.cancelAtPeriodEnd ? (
                <p>Cancelamento agendado. Você ainda pode desfazer até {dateBR(sub.currentPeriodEnd)}.</p>
              ) : (
                <>
                  <p>
                    Sem multa e sem burocracia.{" "}
                    {sub.status === "PAUSED" ? "A assinatura termina agora." : sub.status === "PAST_DUE" ? "A cobrança em aberto é cancelada." : `A loja segue no ar até ${dateBR(sub.currentPeriodEnd)}.`}
                  </p>
                  <div className="row-actions">
                    {refundable.length > 0 && (
                      <ConfirmForm
                        action={cancelAction}
                        hidden={{ id: sub.id, refund: "on" }}
                        trigger={`Cancelar e receber ${money(refundTotal)}`}
                        triggerClass="ui-btn danger-soft sm"
                        title="Cancelar com reembolso integral?"
                        description={`Você está dentro dos ${s.refund_days} dias do direito de arrependimento: estornamos ${money(refundTotal)} e a assinatura termina agora.`}
                        confirmText="Cancelar e reembolsar"
                        tone="danger"
                      >
                        <ReasonFields id={sub.id} />
                      </ConfirmForm>
                    )}
                    <ConfirmForm
                      action={cancelAction}
                      hidden={hidden}
                      trigger="Cancelar assinatura"
                      triggerClass="ui-btn quiet sm"
                      title="Cancelar a assinatura?"
                      description={
                        sub.status === "PAUSED"
                          ? "A assinatura termina agora. Nada será cobrado."
                          : sub.status === "PAST_DUE"
                            ? "A assinatura termina agora e a cobrança em aberto é cancelada. Nada será cobrado."
                            : `Sua loja continua no ar até ${dateBR(sub.currentPeriodEnd)} e nada mais será cobrado. Dá para desfazer até lá.`
                      }
                      confirmText="Confirmar cancelamento"
                      tone="danger"
                    >
                      <ReasonFields id={`${sub.id}-n`} />
                    </ConfirmForm>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      )}

      {(sub.invoices.length > 0 || sub.events.length > 0) && (
        <div className="ui-grid-2">
          <Card>
            <CardHeader title="Cobranças" subtitle={sub.invoices.length ? "Todos os pagamentos desta assinatura" : "Nenhuma cobrança até agora"} icon="receipt" />
            {sub.invoices.length > 0 ? (
              <div className="ui-table-wrap">
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Descrição</th>
                      <th className="r">Valor</th>
                      <th className="r">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sub.invoices.map((i) => {
                      const st = INVOICE[i.status] ?? { label: i.status, tone: "neutral" as Tone };
                      return (
                        <tr key={i.id}>
                          <td className="tabular">{dateBR(i.paidAt ?? i.dueDate)}</td>
                          <td>
                            {i.kind === "DOMAIN" ? "Registro de domínio" : i.domainCents ? "Plano + domínio" : "Plano"}
                            {i.periodEnd && <small>até {dateBR(i.periodEnd)}</small>}
                            {i.failureReason && i.status === "FAILED" && <small>{i.failureReason}</small>}
                          </td>
                          <td className="r tabular">
                            <b>{money(i.amountCents)}</b>
                          </td>
                          <td className="r">
                            <Badge tone={st.tone}>{st.label}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rules">Quando houver cobranças, cada uma aparece aqui com a situação.</p>
            )}
          </Card>
          <Card>
            <CardHeader title="Histórico" icon="clock" />
            <ul className="timeline">
              {sub.events.map((e) => (
                <li key={e.id}>
                  <span>
                    {EVENT_LABEL[e.kind] ?? e.kind}
                    {e.amountCents ? ` · ${money(Math.abs(e.amountCents))}` : ""}
                    <small>
                      {dateBR(e.createdAt)}
                      {e.detail && !["paid", "renewed", "created"].includes(e.kind) ? ` · ${e.detail}` : ""}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}

function ReasonFields({ id }: { id: string }) {
  return (
    <>
      <div className="field" style={{ margin: 0 }}>
        <label htmlFor={`reason-${id}`}>Pode nos contar o motivo? (opcional)</label>
        <select id={`reason-${id}`} name="reason" defaultValue="" className="ui-input">
          <option value="">Prefiro não dizer</option>
          {CANCEL_REASONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </div>
      <input name="other" className="ui-input" placeholder="Algo mais que queira contar (opcional)" maxLength={200} aria-label="Detalhe do motivo" />
    </>
  );
}
