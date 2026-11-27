// Textos da cobrança da assinatura conforme o gateway (Mercado Pago, Asaas ou simulado).
import type { Settings } from "./settings-schema";
import { money } from "./format";

export type GatewayKey = "MERCADOPAGO" | "ASAAS" | "SIMULADO";

export function gatewayOf(s: Pick<Settings, "payment_provider">): GatewayKey {
  return s.payment_provider === "ASAAS" ? "ASAAS" : s.payment_provider === "SIMULADO" ? "SIMULADO" : "MERCADOPAGO";
}

export const GATEWAY_NAME: Record<GatewayKey, string> = { MERCADOPAGO: "Mercado Pago", ASAAS: "Asaas", SIMULADO: "ambiente de teste" };

/** Linha abaixo do preço do plano. */
export function planPriceNote(g: GatewayKey, cycle: "MENSAL" | "ANUAL", yearCents: number, s: Settings): string {
  if (g === "ASAAS") return cycle === "ANUAL" ? `${money(yearCents)} por ano · Pix, boleto ou cartão` : "Todo mês no Pix, boleto ou cartão";
  return cycle === "ANUAL" ? `${money(yearCents)} por ano · Pix ou até ${s.annual_max_installments}x` : "Cobrado todo mês no cartão";
}

/** Explicação da cobrança no resumo do checkout. */
export function checkoutNote(g: GatewayKey, cycle: "MENSAL" | "ANUAL", s: Settings): string {
  const fee = money(s.domain_fee_cents);
  if (g === "ASAAS")
    return `Você paga no Pix, boleto ou cartão, escolhendo na fatura. A cada ${cycle === "ANUAL" ? "ano" : "mês"} a nova fatura chega por e-mail. Se a BudStack registrar o seu domínio, a taxa de ${fee} é paga à parte, na sua área de cliente.`;
  if (g === "SIMULADO") return "Ambiente de teste: o pagamento é simulado e nenhum valor é cobrado.";
  return cycle === "ANUAL"
    ? `Pix ou cartão em até ${s.annual_max_installments}x. Se a BudStack registrar o seu domínio, a taxa de ${fee} entra neste pagamento.`
    : `Cobrança automática no cartão todo mês. Se a BudStack registrar o seu domínio, a taxa de ${fee} é paga à parte, na sua área de cliente.`;
}

/** Trecho das condições aceitas no checkout. */
export function termsBilling(g: GatewayKey, cycle: "MENSAL" | "ANUAL"): string {
  if (g === "ASAAS") return `cobrança ${cycle === "ANUAL" ? "anual" : "mensal"} recorrente por fatura (Pix, boleto ou cartão), que posso cancelar quando quiser`;
  return cycle === "MENSAL" ? "cobrança mensal automática no cartão, que posso cancelar quando quiser" : "pagamento anual, com o link da renovação enviado antes do vencimento";
}

/** Resposta da pergunta frequente sobre cobrança. */
export function faqBilling(g: GatewayKey, s: Settings): string {
  if (g === "ASAAS") return "Você assina no mensal ou no anual e paga cada fatura no Pix, boleto ou cartão. A nova fatura chega por e-mail antes do vencimento.";
  return `No plano mensal, a cobrança é automática no cartão. No anual, você paga uma vez no Pix ou em até ${s.annual_max_installments}x no cartão e recebe o link da renovação antes do vencimento.`;
}
