/**
 * Mapa das configurações do painel: rótulo, explicação, tipo e limites.
 * Usado pela tela (formulário) e pelo servidor (validação antes de gravar).
 * Senhas e chaves (Mercado Pago, SMTP, CallMeBot) ficam nas variáveis de ambiente, nunca aqui.
 */

export type SettingKind = "int" | "money" | "text" | "email" | "toggle" | "phone";

export interface SettingField {
  key: SettingKey;
  label: string;
  hint?: string;
  kind: SettingKind;
  min?: number;
  max?: number;
  suffix?: string;
}

export interface SettingCard {
  title: string;
  description?: string;
  fields: SettingField[];
}

export const DEFAULT_SETTINGS = {
  annual_months_charged: 10,
  annual_max_installments: 12,
  domain_fee_cents: 8000,
  setup_business_days: 7,
  grace_days: 7,
  refund_days: 7,
  renewal_notice_days: 10,
  pending_expire_days: 7,
  notify_email: "",
  notify_whatsapp: true,
  contact_whatsapp: "5519981687551",
  contact_instagram: "budstack.tech",
};

export type Settings = typeof DEFAULT_SETTINGS;
export type SettingKey = keyof Settings;

export const SETTING_CARDS: SettingCard[] = [
  {
    title: "Preço e pagamento",
    description: "Como os valores dos planos viram cobrança. Os preços de cada plano ficam em Planos e recursos.",
    fields: [
      { key: "annual_months_charged", label: "Mensalidades cobradas no plano anual", kind: "int", min: 1, max: 12, suffix: "de 12", hint: "10 = 2 meses grátis no anual." },
      { key: "annual_max_installments", label: "Parcelas no cartão (anual)", kind: "int", min: 1, max: 12, suffix: "x" },
      { key: "domain_fee_cents", label: "Taxa de registro de domínio (1º ano)", kind: "money", min: 0, max: 100000, hint: "Cobrada quando a BudStack registra o domínio para o cliente." },
      { key: "setup_business_days", label: "Prazo de implantação", kind: "int", min: 1, max: 60, suffix: "dias úteis", hint: "Exibido nos planos, no checkout e no e-mail de boas-vindas." },
    ],
  },
  {
    title: "Cancelamento e inadimplência",
    description: "Regras aplicadas automaticamente na rotina diária de cobrança.",
    fields: [
      { key: "refund_days", label: "Reembolso integral até", kind: "int", min: 7, max: 30, suffix: "dias", hint: "Após o 1º pagamento. O mínimo é 7 dias (CDC, art. 49)." },
      { key: "grace_days", label: "Tolerância de pagamento em atraso", kind: "int", min: 0, max: 30, suffix: "dias", hint: "Depois disso, sem pagamento, a assinatura é encerrada e você é avisado para suspender a loja." },
      { key: "renewal_notice_days", label: "Aviso de renovação do anual", kind: "int", min: 3, max: 30, suffix: "dias antes", hint: "Quando o link de pagamento da renovação é enviado ao cliente." },
      { key: "pending_expire_days", label: "Descartar pedidos não pagos após", kind: "int", min: 1, max: 30, suffix: "dias", hint: "Pedidos que nunca foram pagos saem da lista de pendentes." },
    ],
  },
  {
    title: "Avisos para você",
    description: "Para onde vão os avisos de nova assinatura, atraso, cancelamento e reembolso.",
    fields: [
      { key: "notify_email", label: "E-mail que recebe os avisos", kind: "email", hint: "Vazio = usa a variável NOTIFY_EMAIL." },
      { key: "notify_whatsapp", label: "Avisar também no WhatsApp", kind: "toggle", hint: "Usa o CallMeBot configurado nas variáveis de ambiente." },
    ],
  },
  {
    title: "Contato no site",
    fields: [
      { key: "contact_whatsapp", label: "WhatsApp exibido no site", kind: "phone", hint: "Com DDI, só números. Ex.: 5519999999999" },
      { key: "contact_instagram", label: "Instagram", kind: "text", hint: "Sem o @." },
    ],
  },
];

export const SETTING_FIELDS = SETTING_CARDS.flatMap((c) => c.fields);
