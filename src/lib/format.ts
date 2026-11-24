import type { Cycle } from "./plans";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function money(cents: number): string {
  return brl.format(cents / 100);
}

export function cycleLabel(cycle: string): string {
  return cycle === "ANUAL" ? "anual" : "mensal";
}

export function priceSuffix(cycle: Cycle | string): string {
  return cycle === "ANUAL" ? "/ano" : "/mês";
}

export function dateTime(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

export function onlyDigits(v: string): string {
  return v.replace(/\D/g, "");
}

export function formatPhone(v: string): string {
  const d = onlyDigits(v).replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v;
}

export function formatDocument(v: string): string {
  const d = onlyDigits(v);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return v;
}

/** Link do WhatsApp para um número brasileiro (DDI 55 quando faltar). */
export function whatsappUrl(phone: string, text?: string): string {
  const d = onlyDigits(phone);
  const full = d.length <= 11 ? `55${d}` : d;
  return `https://wa.me/${full}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export const STATUS_LABEL: Record<string, string> = {
  PENDING: "Aguardando pagamento",
  PAID: "Pago",
  CANCELLED: "Cancelado",
};

export const STAGES = [
  { id: "NOVO", label: "Novo" },
  { id: "CONFIGURANDO", label: "Configurando" },
  { id: "NO_AR", label: "No ar" },
  { id: "CANCELADO", label: "Cancelado" },
] as const;

export function stageLabel(id: string): string {
  return STAGES.find((s) => s.id === id)?.label ?? id;
}
