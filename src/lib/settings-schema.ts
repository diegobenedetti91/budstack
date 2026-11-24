/**
 * Mapa das configurações do painel: seções, rótulos, explicações, tipos e limites.
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
  prefix?: string;
  suffix?: string;
}

export interface SettingCard {
  title: string;
  description?: string;
  fields: SettingField[];
}

export interface SettingSection {
  key: string;
  label: string;
  hint: string;
  icon: string;
  cards: SettingCard[];
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
  pause_max_months: 3,
  pause_cooldown_months: 6,
  notify_email: "",
  notify_whatsapp: true,
  contact_whatsapp: "5519981687551",
  contact_instagram: "budstack.tech",
};

export type Settings = typeof DEFAULT_SETTINGS;
export type SettingKey = keyof Settings;

export const SETTING_SECTIONS: SettingSection[] = [
  {
    key: "cobranca",
    label: "Preço e pagamento",
    hint: "Anual, parcelas, domínio e prazo",
    icon: "card",
    cards: [
      {
        title: "Plano anual",
        description: "Como o preço mensal de cada plano vira o valor do anual. Os preços ficam em Planos e recursos.",
        fields: [
          { key: "annual_months_charged", label: "Mensalidades cobradas no anual", kind: "int", min: 1, max: 12, suffix: "de 12", hint: "10 = 2 meses grátis no anual." },
          { key: "annual_max_installments", label: "Parcelas no cartão", kind: "int", min: 1, max: 12, suffix: "vezes" },
        ],
      },
      {
        title: "Domínio e implantação",
        fields: [
          { key: "domain_fee_cents", label: "Taxa de registro de domínio (1º ano)", kind: "money", min: 0, max: 100000, prefix: "R$", hint: "Cobrada quando a BudStack registra o domínio para o cliente." },
          { key: "setup_business_days", label: "Prazo de implantação", kind: "int", min: 1, max: 60, suffix: "dias úteis", hint: "Exibido nos planos, no checkout e no e-mail de boas-vindas." },
        ],
      },
    ],
  },
  {
    key: "regras",
    label: "Cancelamento e atraso",
    hint: "Reembolso, tolerância e renovação",
    icon: "shield",
    cards: [
      {
        title: "Cancelamento",
        description: "O cliente cancela quando quiser, sem multa; o acesso segue até o fim do período pago.",
        fields: [{ key: "refund_days", label: "Reembolso integral até", kind: "int", min: 7, max: 30, suffix: "dias", hint: "Após o 1º pagamento. O mínimo é 7 dias (CDC, art. 49)." }],
      },
      {
        title: "Pagamento em atraso",
        description: "Aplicado na rotina diária de cobrança.",
        fields: [
          { key: "grace_days", label: "Tolerância com a loja no ar", kind: "int", min: 0, max: 30, suffix: "dias", hint: "Depois disso, sem pagamento, a assinatura é encerrada e você é avisado para suspender a loja." },
          { key: "renewal_notice_days", label: "Aviso de renovação do anual", kind: "int", min: 3, max: 30, suffix: "dias antes", hint: "Quando o link da renovação é enviado ao cliente." },
          { key: "pending_expire_days", label: "Descartar pedidos não pagos após", kind: "int", min: 1, max: 30, suffix: "dias" },
        ],
      },
    ],
  },
  {
    key: "pausa",
    label: "Pausa",
    hint: "Congelar a assinatura",
    icon: "clock",
    cards: [
      {
        title: "Pausar (congelar) a assinatura",
        description: "O cliente pausa a partir do fim do período pago. Sem cobrança na pausa; volta sozinha. Você é avisado para suspender e depois reativar a loja.",
        fields: [
          { key: "pause_max_months", label: "Pausa de até", kind: "int", min: 1, max: 3, suffix: "meses" },
          { key: "pause_cooldown_months", label: "Uma pausa a cada", kind: "int", min: 0, max: 12, suffix: "meses", hint: "0 = sem limite entre pausas." },
        ],
      },
    ],
  },
  {
    key: "avisos",
    label: "Avisos",
    hint: "E-mail e WhatsApp para você",
    icon: "bell",
    cards: [
      {
        title: "Para onde vão os avisos",
        description: "Nova assinatura, atraso, pausa, troca de plano, cancelamento e reembolso.",
        fields: [
          { key: "notify_email", label: "E-mail que recebe os avisos", kind: "email", hint: "Vazio = usa a variável NOTIFY_EMAIL." },
          { key: "notify_whatsapp", label: "Avisar também no WhatsApp", kind: "toggle", hint: "Usa o CallMeBot configurado nas variáveis de ambiente." },
        ],
      },
    ],
  },
  {
    key: "contato",
    label: "Contato no site",
    hint: "WhatsApp e Instagram",
    icon: "msg",
    cards: [
      {
        title: "Contato exibido no site",
        fields: [
          { key: "contact_whatsapp", label: "WhatsApp", kind: "phone", hint: "Com DDI, só números. Ex.: 5519999999999" },
          { key: "contact_instagram", label: "Instagram", kind: "text", prefix: "@" },
        ],
      },
    ],
  },
];

export const SETTING_CARDS: SettingCard[] = SETTING_SECTIONS.flatMap((s) => s.cards);
export const SETTING_FIELDS = SETTING_CARDS.flatMap((c) => c.fields);
