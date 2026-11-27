import "server-only";

/**
 * Cliente da API do Asaas (assinatura recorrente com Pix, boleto ou cartão na página da fatura).
 * Variáveis: ASAAS_API_KEY, ASAAS_ENV=sandbox|production (ou ASAAS_BASE_URL), ASAAS_WEBHOOK_TOKEN.
 * O que decide se algo foi pago é sempre consultado aqui, na API (o webhook só diz o que mudou).
 */

export class AsaasError extends Error {}

export function asaasBase(): string {
  if (process.env.ASAAS_BASE_URL) return process.env.ASAAS_BASE_URL.replace(/\/+$/, "");
  // Produção: confira a URL na documentação do Asaas antes de ativar.
  return process.env.ASAAS_ENV === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
}

async function asaas<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new AsaasError("Pagamento indisponível: o Asaas não está configurado (ASAAS_API_KEY).");
  const res = await fetch(`${asaasBase()}${path}`, {
    method: init.method ?? "GET",
    headers: { access_token: key, "Content-Type": "application/json", "User-Agent": "BudStack/1.0" },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as T & { errors?: { description?: string }[] };
  if (!res.ok) {
    const msg = body.errors?.[0]?.description ?? `HTTP ${res.status}`;
    console.error("[asaas]", init.method ?? "GET", path, msg);
    throw new AsaasError(`O Asaas recusou a operação: ${msg}`);
  }
  return body;
}

export type AsaasPaymentStatus =
  | "PENDING"
  | "RECEIVED"
  | "CONFIRMED"
  | "OVERDUE"
  | "REFUNDED"
  | "RECEIVED_IN_CASH"
  | "REFUND_REQUESTED"
  | "REFUND_IN_PROGRESS"
  | "CHARGEBACK_REQUESTED"
  | "CHARGEBACK_DISPUTE"
  | "AWAITING_CHARGEBACK_REVERSAL"
  | "DUNNING_REQUESTED"
  | "DUNNING_RECEIVED"
  | "AWAITING_RISK_ANALYSIS";

export interface AsaasPayment {
  id: string;
  status: AsaasPaymentStatus;
  value: number;
  dueDate: string; // AAAA-MM-DD
  paymentDate?: string | null;
  clientPaymentDate?: string | null;
  confirmedDate?: string | null;
  billingType?: string;
  invoiceUrl?: string | null;
  subscription?: string | null;
  externalReference?: string | null;
  deleted?: boolean;
}

export const isPaid = (p: AsaasPayment) => ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "DUNNING_RECEIVED"].includes(p.status);
export const isRefunded = (p: AsaasPayment) => ["REFUNDED", "REFUND_REQUESTED", "REFUND_IN_PROGRESS", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE"].includes(p.status);
/** Data em que o pagamento entrou (ou hoje, se o Asaas não informar). */
export function paidDate(p: AsaasPayment): Date {
  const d = p.paymentDate || p.clientPaymentDate || p.confirmedDate;
  return d ? new Date(`${d}T12:00:00-03:00`) : new Date();
}

/** Data de hoje (ou de `d`) no formato do Asaas, no fuso de Brasília. */
export function asaasDate(d?: Date | null): string {
  return new Date((d ?? new Date()).getTime() - 3 * 3600e3).toISOString().slice(0, 10);
}

export async function createCustomer(c: { name: string; email: string; cpfCnpj: string; phone: string; externalReference: string }): Promise<string> {
  const r = await asaas<{ id: string }>("/customers", {
    method: "POST",
    body: { name: c.name, email: c.email, cpfCnpj: c.cpfCnpj, mobilePhone: c.phone, externalReference: c.externalReference, notificationDisabled: false },
  });
  return r.id;
}

/** Assinatura recorrente. billingType UNDEFINED: o cliente escolhe Pix, boleto ou cartão na fatura. */
export async function createSubscription(s: { customer: string; valueCents: number; cycle: "MONTHLY" | "YEARLY"; nextDueDate: string; description: string; externalReference: string }): Promise<{ id: string; status: string }> {
  return asaas("/subscriptions", {
    method: "POST",
    body: { customer: s.customer, billingType: "UNDEFINED", value: s.valueCents / 100, nextDueDate: s.nextDueDate, cycle: s.cycle, description: s.description, externalReference: s.externalReference },
  });
}

export function getSubscription(id: string): Promise<{ id: string; status: string; deleted?: boolean; nextDueDate?: string; value?: number }> {
  return asaas(`/subscriptions/${encodeURIComponent(id)}`);
}

export async function listSubscriptionPayments(subscriptionId: string): Promise<AsaasPayment[]> {
  const r = await asaas<{ data?: AsaasPayment[] }>(`/subscriptions/${encodeURIComponent(subscriptionId)}/payments?limit=100`);
  return (r.data ?? []).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** Encerra a recorrência; o Asaas remove as cobranças pendentes dela. */
export async function deleteSubscription(id: string): Promise<void> {
  await asaas(`/subscriptions/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** Pausa (INACTIVE: para de gerar cobranças) ou retoma (ACTIVE, com o próximo vencimento). */
export async function setSubscriptionStatus(id: string, status: "ACTIVE" | "INACTIVE", nextDueDate?: string): Promise<void> {
  await asaas(`/subscriptions/${encodeURIComponent(id)}`, { method: "PUT", body: { status, ...(nextDueDate ? { nextDueDate } : {}) } });
}

/** Novo valor/descrição: vale a partir da próxima cobrança gerada. */
export async function updateSubscriptionValue(id: string, valueCents: number, description: string): Promise<void> {
  await asaas(`/subscriptions/${encodeURIComponent(id)}`, { method: "PUT", body: { value: valueCents / 100, description, updatePendingPayments: false } });
}

/** Cobrança avulsa (ex.: taxa de registro de domínio). */
export async function createPayment(p: { customer: string; valueCents: number; dueDate: string; description: string; externalReference: string }): Promise<AsaasPayment> {
  return asaas("/payments", {
    method: "POST",
    body: { customer: p.customer, billingType: "UNDEFINED", value: p.valueCents / 100, dueDate: p.dueDate, description: p.description, externalReference: p.externalReference },
  });
}

export function getPayment(id: string): Promise<AsaasPayment> {
  return asaas(`/payments/${encodeURIComponent(id)}`);
}

export async function deletePayment(id: string): Promise<void> {
  await asaas(`/payments/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** Estorno integral. */
export async function refundPayment(id: string): Promise<void> {
  await asaas(`/payments/${encodeURIComponent(id)}/refund`, { method: "POST", body: { description: "Direito de arrependimento (CDC, art. 49)" } });
}
