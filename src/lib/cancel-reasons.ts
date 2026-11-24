/** Motivos de cancelamento perguntados ao cliente (aparecem no BI). */
export const CANCEL_REASONS = [
  "O preço ficou alto para mim",
  "Não estou vendendo o suficiente",
  "Faltou algum recurso que eu preciso",
  "Vou usar outra plataforma",
  "Tive problemas com a loja ou o suporte",
  "Vou pausar ou encerrar o negócio",
  "Outro motivo",
] as const;

export function normalizeCancelReason(reason: string, other: string): string {
  if (!CANCEL_REASONS.includes(reason as (typeof CANCEL_REASONS)[number])) return "";
  return reason === "Outro motivo" && other.trim() ? `Outro: ${other.trim().slice(0, 200)}` : reason;
}
