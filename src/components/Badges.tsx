import type { Subscription } from "@prisma/client";
import { stageLabel } from "@/lib/format";

/** Situação da assinatura em linguagem simples (inclui cancelamento agendado). */
export function subscriptionState(s: Pick<Subscription, "status" | "cancelAtPeriodEnd">): { label: string; tone: string } {
  if (s.status === "ACTIVE") return s.cancelAtPeriodEnd ? { label: "Cancelamento agendado", tone: "amber" } : { label: "Ativa", tone: "green" };
  if (s.status === "PAST_DUE") return { label: "Inadimplente", tone: "red" };
  if (s.status === "PENDING") return { label: "Aguardando pagamento", tone: "amber" };
  if (s.status === "EXPIRED") return { label: "Encerrada (sem pagamento)", tone: "gray" };
  return { label: "Cancelada", tone: "gray" };
}

export function StatusBadge({ sub }: { sub: Pick<Subscription, "status" | "cancelAtPeriodEnd"> }) {
  const st = subscriptionState(sub);
  return <span className={`badge ${st.tone}`}>{st.label}</span>;
}

export function StageBadge({ stage }: { stage: string }) {
  const tone = stage === "NO_AR" ? "green" : stage === "CONFIGURANDO" ? "blue" : stage === "CANCELADO" ? "red" : "gray";
  return <span className={`badge ${tone}`}>{stageLabel(stage)}</span>;
}

export function DomainBadge({ option, paid }: { option: string; paid: boolean }) {
  if (option === "OWN") return <span className="badge gray">Já tem domínio</span>;
  return <span className={`badge ${paid ? "blue" : "amber"}`}>{paid ? "Registrar (taxa paga)" : "Registrar (taxa pendente)"}</span>;
}

const INVOICE: Record<string, { label: string; tone: string }> = {
  PENDING: { label: "A pagar", tone: "amber" },
  PAID: { label: "Paga", tone: "green" },
  FAILED: { label: "Recusada", tone: "red" },
  REFUNDED: { label: "Estornada", tone: "blue" },
  CANCELED: { label: "Cancelada", tone: "gray" },
};

export function InvoiceBadge({ status }: { status: string }) {
  const i = INVOICE[status] ?? { label: status, tone: "gray" };
  return <span className={`badge ${i.tone}`}>{i.label}</span>;
}

export const EVENT_LABEL: Record<string, string> = {
  created: "Pedido criado",
  paid: "Primeiro pagamento",
  renewed: "Renovação paga",
  domain_paid: "Taxa de domínio paga",
  past_due: "Pagamento não confirmado",
  cancel_requested: "Cancelamento pedido",
  cancel_undone: "Cancelamento desfeito",
  canceled: "Encerrada",
  refunded: "Reembolso",
  expired: "Encerrada por falta de pagamento",
  paid_after_cancel: "Pagamento após cancelamento",
};
