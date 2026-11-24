// Formatação usada pelo BI no servidor e nos gráficos no navegador.

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function fmt(v: number, kind: "money" | "int" | "pct"): string {
  if (kind === "money") return brl.format(v / 100);
  if (kind === "pct") return `${(v * 100).toFixed(1).replace(".", ",")}%`;
  return v.toLocaleString("pt-BR");
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const monthLabel = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]}/${key.slice(2, 4)}`;
/** Rótulo curto do eixo: só o mês, com o ano em janeiro e no primeiro ponto. */
export const monthTick = (key: string, i: number) => (i === 0 || key.endsWith("-01") ? monthLabel(key) : MONTHS[Number(key.slice(5, 7)) - 1]);
