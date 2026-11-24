import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { getPlan } from "@/lib/plans";
import { STAGES, cycleLabel, dateTime, formatDocument, formatPhone, money, priceSuffix, whatsappUrl } from "@/lib/format";
import { DomainBadge, StageBadge, StatusBadge } from "@/components/Badges";
import { reconcileAction, updateStageAction } from "./actions";

const MP_SUB_LABEL: Record<string, string> = { pending: "Aguardando autorização", authorized: "Ativa", paused: "Pausada", cancelled: "Cancelada" };

export default async function AssinaturaPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const s = await prisma.subscription.findUnique({ where: { id } });
  if (!s) notFound();
  const plan = getPlan(s.plan);

  return (
    <>
      <Link href="/admin" className="muted" style={{ fontSize: 14, fontWeight: 600 }}>
        ← Assinaturas
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
        <h1>{s.storeName}</h1>
        <StatusBadge status={s.status} />
        <StageBadge stage={s.stage} />
      </div>
      <p className="muted" style={{ marginTop: 4 }}>
        Pedido {s.code} · criado em {dateTime(s.createdAt)}
      </p>

      <div className="detail">
        <div>
          <section className="card">
            <h2>Plano e pagamento</h2>
            <dl className="kv">
              <dt>Plano</dt>
              <dd>
                {plan?.name ?? s.plan} ({cycleLabel(s.cycle)}) · {money(s.planPriceCents)}
                {priceSuffix(s.cycle)}
              </dd>
              <dt>Primeira cobrança</dt>
              <dd>{money(s.totalCents)}</dd>
              <dt>Pago em</dt>
              <dd>{dateTime(s.paidAt)}</dd>
              {s.cycle === "MENSAL" && (
                <>
                  <dt>Assinatura no MP</dt>
                  <dd>{s.mpSubscriptionStatus ? (MP_SUB_LABEL[s.mpSubscriptionStatus] ?? s.mpSubscriptionStatus) : "—"}</dd>
                </>
              )}
              <dt>Aviso enviado</dt>
              <dd>{s.notifiedAt ? dateTime(s.notifiedAt) : s.status === "PAID" ? "Não (confira SMTP/CallMeBot)" : "—"}</dd>
              <dt>Mercado Pago</dt>
              <dd style={{ fontSize: 13 }}>{[s.mpPaymentId && `pagamento ${s.mpPaymentId}`, s.mpPreapprovalId && `assinatura ${s.mpPreapprovalId}`].filter(Boolean).join(" · ") || "—"}</dd>
            </dl>
            <form action={reconcileAction} style={{ marginTop: 18 }}>
              <input type="hidden" name="id" value={s.id} />
              <button className="btn btn-ghost btn-sm">Conferir no Mercado Pago</button>
            </form>
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
                    {money(s.domainFeeCents)} · {s.domainPaidAt ? `paga em ${dateTime(s.domainPaidAt)}` : "pendente"}
                  </dd>
                </>
              )}
            </dl>
          </section>

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
            </dl>
          </section>
        </div>

        <section className="card">
          <h2>Implantação</h2>
          <form action={updateStageAction}>
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
          </form>
        </section>
      </div>
    </>
  );
}
