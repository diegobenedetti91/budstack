// Planos da VirtualStore vendidos no site.
//
// ⚠️ VALORES PROVISÓRIOS: troque os preços abaixo pelos seus antes de publicar.
// Os valores são congelados em cada assinatura no momento da compra, então mudar
// aqui não altera quem já assinou.

export type Cycle = "MENSAL" | "ANUAL";

export interface Plan {
  id: "essencial" | "profissional" | "completo";
  name: string;
  tagline: string;
  /** Mensalidade em centavos */
  monthlyCents: number;
  highlight?: boolean;
  /** Itens mostrados no card. O primeiro item dos planos maiores resume o anterior. */
  features: string[];
}

export const PLANS: Plan[] = [
  {
    id: "essencial",
    name: "Essencial",
    tagline: "Para começar a vender online com a sua marca.",
    monthlyCents: 14900,
    features: [
      "Loja completa com a sua marca, logo e cores",
      "Catálogo com tamanhos, cores e estoque por variação",
      "Pix, cartão, NuPay, InfinitePay e pedido pelo WhatsApp",
      "Frete pelo CEP: Correios, Melhor Envio, local ou retirada",
      "Cupons e promoções relâmpago",
      "Área do cliente com pedidos e rastreio",
      "Painel com pedidos, clientes e relatórios",
    ],
  },
  {
    id: "profissional",
    name: "Profissional",
    tagline: "Para quem quer a operação no automático.",
    monthlyCents: 24900,
    highlight: true,
    features: [
      "Tudo do Essencial",
      "Nota fiscal automática pelo Bling",
      "Etiqueta automática do Melhor Envio",
      "Aviso de novo pedido com checklist",
      "Cashback com crédito na loja",
      "Recuperação de carrinho abandonado",
      "DRE com lucro real, impostos e perdas",
    ],
  },
  {
    id: "completo",
    name: "Completo",
    tagline: "Para crescer com IA e marketing de dados.",
    monthlyCents: 39900,
    features: [
      "Tudo do Profissional",
      "Atendimento com IA 24h",
      "Meta Pixel + API de Conversões",
      "Interesse por produto e aviso de promoção",
      "Funil de conversão e origem de cada pedido",
      "Suporte prioritário",
    ],
  },
];

/** O plano anual cobra este número de mensalidades (12 − 2 meses grátis). */
export const ANNUAL_MONTHS_CHARGED = 10;
/** Parcelas sem juros oferecidas no plano anual (cartão). */
export const ANNUAL_MAX_INSTALLMENTS = 12;

/** Taxa de registro do domínio .com.br por 1 ano, quando a BudStack registra para o cliente. */
export const DOMAIN_FEE_CENTS = 8000;

/** Prazo prometido para a loja estar no ar depois do pagamento e do envio dos materiais. */
export const SETUP_BUSINESS_DAYS = 7;

export function getPlan(id: string | null | undefined): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

export function isCycle(v: unknown): v is Cycle {
  return v === "MENSAL" || v === "ANUAL";
}

/** Valor do plano no ciclo escolhido, em centavos. */
export function planPriceCents(plan: Plan, cycle: Cycle): number {
  return cycle === "ANUAL" ? plan.monthlyCents * ANNUAL_MONTHS_CHARGED : plan.monthlyCents;
}
