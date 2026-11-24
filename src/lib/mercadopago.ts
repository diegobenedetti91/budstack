import "server-only";

// Cliente mínimo da API do Mercado Pago.
// Tudo que decide se algo foi pago é consultado aqui, direto na API — nunca no corpo do webhook.

// MP_API_URL só existe para testes com um servidor simulado; em produção fica vazio.
const API = (process.env.MP_API_URL || "https://api.mercadopago.com").replace(/\/+$/, "");

function token(): string {
  const t = process.env.MP_ACCESS_TOKEN;
  if (!t) throw new Error("MP_ACCESS_TOKEN não configurado");
  return t;
}

export function siteUrl(): string {
  return (process.env.SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
}

async function mp<T>(path: string, init?: RequestInit & { idempotencyKey?: string }): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      ...(init?.idempotencyKey ? { "X-Idempotency-Key": init.idempotencyKey } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Mercado Pago ${init?.method || "GET"} ${path} → ${res.status}: ${body.slice(0, 500)}`);
  }
  return res.json() as Promise<T>;
}

export interface MpPayment {
  id: number;
  status: string;
  status_detail?: string;
  transaction_amount: number;
  external_reference?: string | null;
  date_approved?: string | null;
}

export interface MpPreapproval {
  id: string;
  status: string; // pending | authorized | paused | cancelled
  external_reference?: string | null;
  init_point?: string;
  summarized?: { charged_quantity?: number | null; charged_amount?: number | null } | null;
}

/** Link de pagamento único (Checkout Pro): Pix, cartão parcelado e saldo Mercado Pago. */
export async function createPreference(opts: {
  externalReference: string;
  title: string;
  amountCents: number;
  payerEmail: string;
  payerName: string;
  maxInstallments: number;
  backUrl: string;
  /** Link deixa de aceitar pagamento depois desta data */
  expiresAt?: Date;
}): Promise<{ id: string; init_point: string }> {
  return mp("/checkout/preferences", {
    method: "POST",
    idempotencyKey: `pref-${opts.externalReference}`,
    body: JSON.stringify({
      external_reference: opts.externalReference,
      items: [{ id: opts.externalReference, title: opts.title, quantity: 1, unit_price: opts.amountCents / 100, currency_id: "BRL" }],
      payer: { email: opts.payerEmail, name: opts.payerName },
      payment_methods: { installments: opts.maxInstallments },
      back_urls: { success: opts.backUrl, pending: opts.backUrl, failure: opts.backUrl },
      auto_return: "approved",
      notification_url: `${siteUrl()}/api/webhooks/mercadopago`,
      statement_descriptor: "BUDSTACK",
      ...(opts.expiresAt ? { expires: true, expiration_date_to: opts.expiresAt.toISOString() } : {}),
    }),
  });
}

/** Assinatura mensal no cartão. O cliente autoriza no link (init_point) e é cobrado todo mês. */
export async function createPreapproval(opts: {
  externalReference: string;
  reason: string;
  amountCents: number;
  payerEmail: string;
  backUrl: string;
  /** Primeira cobrança nesta data (ex.: ao desfazer um cancelamento, no fim do período pago) */
  startDate?: Date;
  idempotencyKey?: string;
}): Promise<MpPreapproval> {
  return mp("/preapproval", {
    method: "POST",
    idempotencyKey: opts.idempotencyKey ?? `sub-${opts.externalReference}`,
    body: JSON.stringify({
      reason: opts.reason,
      external_reference: opts.externalReference,
      payer_email: opts.payerEmail,
      back_url: opts.backUrl,
      status: "pending",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: opts.amountCents / 100,
        currency_id: "BRL",
        ...(opts.startDate ? { start_date: opts.startDate.toISOString() } : {}),
      },
    }),
  });
}

/** Encerra a assinatura mensal: nada mais é cobrado. */
export async function cancelPreapproval(id: string): Promise<void> {
  await mp(`/preapproval/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) });
}

/** Pausa (status "paused": sem cobranças) ou retoma (status "authorized") a assinatura mensal. */
export async function setPreapprovalStatus(id: string, status: "paused" | "authorized"): Promise<void> {
  await mp(`/preapproval/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ status }) });
}

/** Novo valor da mensalidade: vale a partir da próxima cobrança. */
export async function setPreapprovalAmount(id: string, amountCents: number): Promise<void> {
  await mp(`/preapproval/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ auto_recurring: { transaction_amount: amountCents / 100, currency_id: "BRL" } }),
  });
}

/** Estorno integral de um pagamento. */
export async function refundPayment(paymentId: string, key: string): Promise<void> {
  await mp(`/v1/payments/${encodeURIComponent(paymentId)}/refunds`, { method: "POST", idempotencyKey: `refund-${key}`, body: "{}" });
}

export interface MpAuthorizedPayment {
  id: number;
  preapproval_id?: string;
  /** scheduled | processed | recycling | cancelled */
  status?: string;
  transaction_amount?: number;
  debit_date?: string | null;
  date_created?: string | null;
  payment?: { id?: number; status?: string; status_detail?: string } | null;
}

/** Cobranças mensais de uma assinatura (a mais recente primeiro). */
export async function searchAuthorizedPayments(preapprovalId: string): Promise<MpAuthorizedPayment[]> {
  const q = new URLSearchParams({ preapproval_id: preapprovalId, limit: "100" });
  const data = await mp<{ results?: MpAuthorizedPayment[] }>(`/authorized_payments/search?${q}`);
  const list = data.results ?? [];
  const when = (a: MpAuthorizedPayment) => new Date(a.debit_date || a.date_created || 0).getTime();
  return list.sort((a, b) => when(b) - when(a));
}

export function getPayment(id: string | number): Promise<MpPayment> {
  return mp(`/v1/payments/${encodeURIComponent(String(id))}`);
}

export function getPreapproval(id: string): Promise<MpPreapproval> {
  return mp(`/preapproval/${encodeURIComponent(id)}`);
}

export function getAuthorizedPayment(id: string | number): Promise<MpAuthorizedPayment> {
  return mp(`/authorized_payments/${encodeURIComponent(String(id))}`);
}

/** Pagamentos com este external_reference, do mais recente para o mais antigo. */
export async function searchPayments(externalReference: string): Promise<MpPayment[]> {
  const q = new URLSearchParams({ external_reference: externalReference, sort: "date_created", criteria: "desc", limit: "50" });
  const data = await mp<{ results?: MpPayment[] }>(`/v1/payments/search?${q}`);
  return data.results ?? [];
}
