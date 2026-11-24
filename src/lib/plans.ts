import "server-only";
import { prisma } from "./prisma";
import type { Settings } from "./settings-schema";

// Planos e recursos vêm do banco e são editados em Administração → Planos e recursos.
// Cada assinatura guarda o valor do momento da compra: mudar o preço não afeta quem já assinou.

export type Cycle = "MENSAL" | "ANUAL";

export interface PlanView {
  id: string;
  name: string;
  tagline: string;
  monthlyCents: number;
  highlight: boolean;
  active: boolean;
  sort: number;
  features: { id: string; name: string }[];
}

export async function getPlans(opts: { activeOnly?: boolean } = {}): Promise<PlanView[]> {
  const plans = await prisma.plan.findMany({
    where: opts.activeOnly ? { active: true } : undefined,
    orderBy: [{ sort: "asc" }, { monthlyCents: "asc" }],
    include: { features: { include: { feature: true } } },
  });
  return plans.map((p) => ({
    id: p.id,
    name: p.name,
    tagline: p.tagline,
    monthlyCents: p.monthlyCents,
    highlight: p.highlight,
    active: p.active,
    sort: p.sort,
    features: p.features
      .map((pf) => pf.feature)
      .filter((f) => f.active)
      .sort((a, b) => a.sort - b.sort)
      .map((f) => ({ id: f.id, name: f.name })),
  }));
}

export async function getPlan(id: string | null | undefined, opts: { activeOnly?: boolean } = {}): Promise<PlanView | undefined> {
  if (!id || !/^[a-z0-9-]{1,40}$/.test(id)) return undefined;
  const plans = await getPlans(opts);
  return plans.find((p) => p.id === id);
}

/** Nome do plano para exibição (assinaturas antigas podem apontar para plano removido). */
export async function planNames(): Promise<Map<string, string>> {
  const rows = await prisma.plan.findMany({ select: { id: true, name: true } });
  return new Map(rows.map((r) => [r.id, r.name]));
}

export function isCycle(v: unknown): v is Cycle {
  return v === "MENSAL" || v === "ANUAL";
}

/** Valor do plano no ciclo, em centavos. */
export function planPriceCents(plan: { monthlyCents: number }, cycle: Cycle, s: Pick<Settings, "annual_months_charged">): number {
  return cycle === "ANUAL" ? plan.monthlyCents * s.annual_months_charged : plan.monthlyCents;
}
