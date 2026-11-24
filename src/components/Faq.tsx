import type { Settings } from "@/lib/settings-schema";
import { money } from "@/lib/format";
import { Icon } from "./Icon";

/** Perguntas frequentes; prazos e valores vêm das configurações do painel. */
export function Faq({ s }: { s: Settings }) {
  const items: [string, string][] = [
    ["Preciso entender de tecnologia?", "Não. A gente monta a loja com a sua marca, configura pagamentos, frete e integrações. No dia a dia você cadastra produtos e acompanha os pedidos por um painel simples, em português."],
    [
      "Em quanto tempo minha loja fica pronta?",
      `Em até ${s.setup_business_days} dias úteis depois do pagamento e do envio do logo, das cores e das informações da loja.`,
    ],
    [
      "E se eu ainda não tiver domínio?",
      `A gente registra o domínio (ex.: suamarca.com.br) em seu nome por ${money(s.domain_fee_cents)} o primeiro ano. Se você já tem, só ajudamos a apontá-lo para a loja.`,
    ],
    [
      "Como funciona a cobrança?",
      `No plano mensal, a cobrança é automática no cartão. No anual, você paga uma vez no Pix ou em até ${s.annual_max_installments}x no cartão e recebe o link da renovação antes do vencimento.`,
    ],
    [
      "Posso cancelar quando quiser?",
      `Sim, sem multa, pela sua área de cliente. A loja continua no ar até o fim do período pago. Até ${s.refund_days} dias depois do primeiro pagamento, o cancelamento tem reembolso integral.`,
    ],
    ["Quais formas de pagamento minha loja aceita?", "Pix e cartão dentro da própria loja pelo Mercado Pago, além de NuPay, InfinitePay e pedido pelo WhatsApp. Você escolhe quais ficam ativas."],
  ];
  return (
    <div className="faq">
      {items.map(([q, a]) => (
        <details key={q}>
          <summary>
            {q}
            <span className="faq-ic" aria-hidden="true">
              +
            </span>
          </summary>
          <p>{a}</p>
        </details>
      ))}
    </div>
  );
}

export function HelpBox({ whatsapp }: { whatsapp: string }) {
  return (
    <div className="help-box">
      <div>
        <b>Ficou com alguma dúvida?</b>
        <span>Fale com a gente no WhatsApp: respondemos rápido e te ajudamos a escolher o plano.</span>
      </div>
      <a className="btn btn-ghost" href={whatsapp} target="_blank" rel="noopener noreferrer">
        <Icon name="msg" className="ico sm" /> Chamar no WhatsApp
      </a>
    </div>
  );
}
