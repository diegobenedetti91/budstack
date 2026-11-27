import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Faq, HelpBox } from "@/components/Faq";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { PhoneMock } from "@/components/marketing/PhoneMock";
import { Marquee } from "@/components/marketing/Marquee";
import { BrandPreview } from "@/components/marketing/BrandPreview";
import { MarketingEffects } from "@/components/marketing/MarketingEffects";
import { getPlans } from "@/lib/plans";
import { getSettings } from "@/lib/settings";
import { money, whatsappUrl } from "@/lib/format";

export const metadata: Metadata = {
  title: "VirtualStore — a loja virtual de moda que vende no automático",
  description: "Checkout com Pix e cartão, atendimento com IA 24h, nota fiscal e etiqueta automáticas, cashback, cupons e relatórios de lucro real.",
};
export const dynamic = "force-dynamic";

function Item({ icon, color = "blue", title, text }: { icon: string; color?: string; title: string; text: string }) {
  return (
    <li>
      <span className={`mk-ic ${color}`}>
        <Icon name={icon} />
      </span>
      <div>
        <b>{title}</b>
        <span>{text}</span>
      </div>
    </li>
  );
}

const GROUPS: { icon: string; color: string; title: string; items: string[] }[] = [
  { icon: "store", color: "blue", title: "Loja virtual", items: ["Vitrine responsiva com banner e novidades", "Grade de tamanhos e cores por produto", "Favoritos e vistos recentemente", "Área do cliente com pedidos, rastreio e nota", "Login com Google e cadastro rápido"] },
  { icon: "card", color: "violet", title: "Vendas e pagamentos", items: ["Pix e cartão no checkout (Mercado Pago)", "NuPay, InfinitePay e pedido pelo WhatsApp", "Checkout em 3 passos com validação", "Cashback com crédito na loja", "Cupons, promoções e carrinho abandonado"] },
  { icon: "layers", color: "green", title: "Catálogo", items: ["Estoque por variação", "Variações e atributos personalizados", "Categorias e menu editáveis", "Avaliações com aprovação", "Lista de espera por tamanho e cor"] },
  { icon: "truck", color: "amber", title: "Entregas", items: ["Frete Melhor Envio, Correios, local ou fixo", "Retirada na loja e restrição por região", "Etiquetas automáticas para impressora térmica", "Rastreamento com alertas de problemas", "Embalagens cadastradas para frete exato"] },
  { icon: "file", color: "blue", title: "Fiscal e ERP", items: ["Integração com o Bling", "NF-e automática com status da SEFAZ", "DANFE e XML por e-mail ao cliente", "Sincronização de produtos e clientes", "Trocas e devoluções com estorno"] },
  { icon: "chart", color: "violet", title: "Gestão e inteligência", items: ["Painel com meta do mês e pendências", "DRE com lucro real, impostos e perdas", "Funil de conversão e origem dos pedidos", "Aviso de novo pedido com checklist", "Atendimento com IA 24h e seus insights"] },
];

export default async function VirtualStorePage() {
  const [plans, s] = await Promise.all([getPlans({ activeOnly: true }), getSettings()]);
  const fromPrice = plans.length ? Math.min(...plans.map((p) => p.monthlyCents)) : null;
  const wa = whatsappUrl(s.contact_whatsapp, "Olá! Vi a página da VirtualStore e quero saber mais.");
  const demo = whatsappUrl(s.contact_whatsapp, "Olá! Quero ver uma demonstração da VirtualStore.");

  return (
    <>
      <SiteHeader />
      <main className="mk">
        {/* Hero */}
        <section className="mk-dark mk-hero">
          <span className="mk-glow a" />
          <span className="mk-glow b" />
          <span className="mk-grid-bg" />
          <div className="mk-wrap mk-hero-grid">
            <div>
              <span className="mk-eyebrow">
                <b>VIRTUALSTORE</b> Loja virtual completa para moda
              </span>
              <h1>
                Vende, emite nota e despacha <span className="mk-grad-text">sozinha</span>.
              </h1>
              <p className="lead">Uma loja com a sua marca que recebe o pagamento, emite a nota, gera a etiqueta, avisa o cliente e mostra o seu lucro real. Você cuida das peças; a plataforma cuida do resto.</p>
              <div className="mk-ctas">
                <Link href="/planos" className="mk-btn glow">
                  {fromPrice ? `Assinar a partir de ${money(fromPrice)}/mês` : "Ver planos"} <Icon name="arrow" className="ico sm" />
                </Link>
                <a href={demo} className="mk-btn ghost-dark" target="_blank" rel="noopener noreferrer">
                  Quero uma demonstração
                </a>
              </div>
              <ul className="mk-checks">
                <li>
                  <Icon name="check" className="ico sm" /> Pix e cartão na loja
                </li>
                <li>
                  <Icon name="check" className="ico sm" /> NF-e e etiqueta automáticas
                </li>
                <li>
                  <Icon name="check" className="ico sm" /> Sem programar
                </li>
              </ul>
            </div>
            <div className="mk-hero-visual">
              <PhoneMock />
            </div>
          </div>
          <div className="mk-wrap" style={{ marginTop: "clamp(40px, 6vw, 72px)" }}>
            <Marquee />
          </div>
        </section>

        {/* Vitrine + checkout + cashback */}
        <section className="mk-sec soft" id="recursos">
          <div className="mk-wrap">
            <div className="mk-split">
              <div className="mk-reveal">
                <span className="mk-kicker">Vitrine que converte</span>
                <h2>Uma loja bonita que faz o cliente comprar mais</h2>
                <p>Feita para moda e pensada para o celular, onde estão os seus clientes. No celular, o botão de comprar fica sempre à mão.</p>
                <ul className="mk-list">
                  <Item icon="zap" color="amber" title="Promoção relâmpago com cronômetro" text="Preço “de/por” e contagem regressiva que criam urgência." />
                  <Item icon="layers" color="violet" title="“Combina com” e vistos recentemente" text="Sugestões no produto e no carrinho aumentam o ticket." />
                  <Item icon="bell" color="blue" title="Avise-me quando chegar" text="Tamanho esgotado vira lista de espera com aviso na reposição." />
                  <Item icon="star" color="green" title="Avaliações, favoritos e login com Google" text="Prova social e cadastro em um clique." />
                </ul>
              </div>
              <div className="mk-panel mk-reveal" aria-hidden="true">
                <div className="mk-pdp">
                  <div className="ph mk-p2" />
                  <div>
                    <h4>Vestido Midi Fluido</h4>
                    <div className="mk-stars">
                      ★★★★★<small>48 avaliações</small>
                    </div>
                    <div className="mk-timer">
                      Oferta termina em <code>02:14:37</code>
                    </div>
                    <div className="mk-price">
                      R$ 183,90<s>R$ 229,90</s>
                    </div>
                    <p style={{ fontSize: 12, color: "#047857", fontWeight: 700 }}>R$ 174,70 no Pix · ou 6x no cartão</p>
                    <div className="mk-sizes">
                      <span>P</span>
                      <span className="on">M</span>
                      <span>G</span>
                      <span className="off">GG</span>
                    </div>
                    <div className="mk-cta-sm">Adicionar ao carrinho</div>
                    <p className="mk-note">GG esgotado · avise-me quando chegar</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mk-split rev">
              <div className="mk-reveal">
                <span className="mk-kicker">Checkout sem atrito</span>
                <h2>O cliente paga como quiser, sem sair da sua loja</h2>
                <p>Checkout em 3 passos que confere cada campo e aponta o que falta. Frete calculado pelo CEP na hora.</p>
                <ul className="mk-list">
                  <Item icon="pix" color="green" title="Pix com desconto e cartão parcelado" text="Mercado Pago no próprio site, além de NuPay, InfinitePay e WhatsApp." />
                  <Item icon="truck" color="amber" title="Frete do seu jeito" text="Melhor Envio, Correios, entrega local, frete fixo ou retirada." />
                  <Item icon="star" color="violet" title="Cupons inteligentes" text="Primeira compra, frete grátis, por cliente, com limite e por link." />
                </ul>
              </div>
              <div className="mk-panel mk-reveal" aria-hidden="true">
                <div className="mk-stepchips">
                  <span>✓ Dados</span>
                  <span>✓ Entrega</span>
                  <span>3 Pagamento</span>
                </div>
                <div className="mk-row on">
                  <span className="mk-ic green">
                    <Icon name="pix" />
                  </span>
                  <span>
                    <b>Pix</b>
                    <small>5% de desconto · aprovação na hora</small>
                  </span>
                </div>
                <div className="mk-row">
                  <span className="mk-ic blue">
                    <Icon name="card" />
                  </span>
                  <span>
                    <b>Cartão de crédito</b>
                    <small>Em até 6x, direto na loja</small>
                  </span>
                </div>
                <div className="mk-pill-ok">
                  <Icon name="check" className="ico sm" /> Cupom BEMVINDA10 aplicado · −R$ 18,39
                </div>
                <div className="mk-total">
                  <span>Total</span>
                  <span>R$ 177,71</span>
                </div>
                <p className="mk-cashline">Você ganha R$ 8,89 de cashback nesta compra</p>
              </div>
            </div>

            <div className="mk-split">
              <div className="mk-reveal">
                <span className="mk-kicker">Cashback</span>
                <h2>Crédito na loja que faz o cliente voltar</h2>
                <p>A cada compra, uma parte volta como crédito para a próxima. O cliente vê no produto, no carrinho e na conta dele.</p>
                <ul className="mk-list">
                  <Item icon="settings" color="blue" title="Regras do seu jeito" text="Percentual, prazo de liberação, validade, pedido mínimo e limite." />
                  <Item icon="msg" color="violet" title="Lembretes automáticos" text="E-mail quando o crédito libera e quando está para vencer." />
                  <Item icon="shield" color="green" title="Saldo sempre certo" text="Cancelamentos e devoluções ajustam o crédito sozinhos." />
                </ul>
              </div>
              <div className="mk-panel mk-reveal" aria-hidden="true">
                <div className="mk-credit">
                  <small>Saldo disponível</small>
                  <b>R$ 42,80</b>
                  <span>A liberar R$ 18,30 · vence em 12/01</span>
                </div>
                <div className="mk-row" style={{ marginTop: 12 }}>
                  <span>
                    <b>Cashback do pedido #1042</b>
                    <small>Liberado após a entrega</small>
                  </span>
                  <span className="end" style={{ color: "#059669" }}>
                    +R$ 14,50
                  </span>
                </div>
                <div className="mk-row">
                  <span>
                    <b>Usado no pedido #1047</b>
                    <small>Desconto no checkout</small>
                  </span>
                  <span className="end">−R$ 20,00</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* IA */}
        <section className="mk-dark mk-sec" id="ia">
          <span className="mk-glow b" />
          <div className="mk-wrap">
            <div className="mk-split">
              <div className="mk-reveal">
                <span className="mk-kicker">Atendimento com IA 24h</span>
                <h2>Uma vendedora que responde na hora, até de madrugada</h2>
                <p>Conhece seu catálogo, suas políticas e os pedidos de cada cliente. Resolve a dúvida que trava a venda e chama você no WhatsApp quando precisa.</p>
                <ul className="mk-list">
                  <Item icon="layers" color="blue" title="Estoque por tamanho e cor" text="“Tem o vestido no M?” A resposta sai na hora, com o preço da promoção." />
                  <Item icon="truck" color="violet" title="Onde está o pedido" text="Status e rastreio, só para o cliente dono do pedido." />
                  <Item icon="msg" color="green" title="WhatsApp só quando precisa" text="A conversa segue no seu WhatsApp já resumida." />
                </ul>
              </div>
              <div className="mk-panel mk-reveal" aria-hidden="true">
                <div className="mk-panel-title">
                  Assistente da loja <span>Online agora</span>
                </div>
                <div className="mk-chat">
                  <div className="mk-msg me">Oi! Tem o vestido midi azul no M?</div>
                  <div className="mk-msg ai">
                    Tem sim! O <b>Vestido Midi Fluido</b> azul no M sai por <b>R$ 183,90</b> (promoção até hoje) ou R$ 174,70 no Pix.
                  </div>
                  <div className="mk-msg me">E meu pedido da semana passada?</div>
                  <div className="mk-msg ai">
                    O pedido <b>#1038</b> foi enviado ontem pelos Correios e chega em até 4 dias úteis.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Operação + gestão */}
        <section className="mk-sec" id="operacao">
          <div className="mk-wrap">
            <div className="mk-split rev">
              <div className="mk-reveal">
                <span className="mk-kicker">Operação no automático</span>
                <h2>Vendeu? Você fica sabendo na hora, e o resto já está pronto</h2>
                <p>Aviso com som e um checklist que se completa sozinho até a encomenda estar pronta para sair.</p>
                <ul className="mk-list">
                  <Item icon="bell" color="amber" title="Aviso de novo pedido" text="Sino com contador, som e aviso no computador, no celular também." />
                  <Item icon="file" color="green" title="NF-e automática pelo Bling" text="Autorizada na SEFAZ e enviada com DANFE e XML; se rejeitar, você vê o motivo." />
                  <Item icon="truck" color="violet" title="Etiqueta sem abrir o Melhor Envio" text="Paga com seu saldo, gera o rastreio e salva o PDF para a térmica." />
                  <Item icon="undo" color="blue" title="Trocas e devoluções" text="O cliente pede pela conta dele, você aprova e o estorno entra no relatório." />
                </ul>
              </div>
              <div className="mk-panel mk-reveal" aria-hidden="true">
                <div className="mk-panel-title">
                  Novo pedido pago · R$ 289,90 <span>PD1047</span>
                </div>
                {["Pagamento aprovado", "Pedido no Bling", "Nota fiscal nº 1.284", "Etiqueta · QB482913570BR"].map((t) => (
                  <div key={t} className="mk-row">
                    <span>
                      <b>{t}</b>
                    </span>
                    <span className="mk-done">
                      <Icon name="check" />
                    </span>
                  </div>
                ))}
                <div className="mk-status">
                  <Icon name="check" className="ico sm" /> Pronto para preparar e despachar
                </div>
                <div className="mk-mini-btns">
                  <span>Imprimir etiqueta</span>
                  <span>Abrir pedido</span>
                </div>
              </div>
            </div>

            <div className="mk-split">
              <div className="mk-reveal">
                <span className="mk-kicker">Gestão e lucro real</span>
                <h2>Saiba quanto sobra de verdade em cada venda</h2>
                <p>O painel monta o seu DRE e desconta descontos, impostos, peças, taxas, frete e devoluções.</p>
                <ul className="mk-list">
                  <Item icon="file" color="blue" title="DRE no padrão de mercado" text="Vendas brutas, faturamento, receita líquida, CMV e impostos." />
                  <Item icon="chart" color="violet" title="Funil e origem das vendas" text="Onde o cliente desiste e de onde vêm as vendas: Instagram, Google, campanhas." />
                  <Item icon="settings" color="amber" title="Meta do mês e perdas" text="Quanto falta para a meta, cancelamentos e carrinhos perdidos." />
                </ul>
              </div>
              <div className="mk-panel mk-reveal" aria-hidden="true">
                <div className="mk-panel-title">
                  Visão geral <span>30 dias</span>
                </div>
                <div className="mk-kpis">
                  <div className="mk-kpi">
                    <small>Faturamento</small>
                    <b>R$ 48.290</b>
                    <em>▲ 18%</em>
                  </div>
                  <div className="mk-kpi">
                    <small>Lucro líquido</small>
                    <b>R$ 14.870</b>
                    <em>▲ 22%</em>
                  </div>
                  <div className="mk-kpi">
                    <small>Ticket médio</small>
                    <b>R$ 231</b>
                    <em>▲ 6%</em>
                  </div>
                </div>
                <div className="mk-bars">
                  {[38, 52, 44, 61, 58, 72, 66, 80, 74, 88, 82, 96].map((h, i) => (
                    <i key={i} style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Marketing */}
        <section className="mk-sec soft" id="marketing">
          <div className="mk-wrap">
            <div className="mk-head mk-reveal">
              <span className="mk-kicker">Marketing que se paga</span>
              <h2>Traga clientes e recupere as vendas que iam embora</h2>
            </div>
            <div className="mk-bento">
              <article className="mk-tile wide grad mk-reveal">
                <span className="mk-ic glass">
                  <Icon name="bell" />
                </span>
                <h3>Avise quem já queria a peça</h3>
                <p>Quando um produto baixa de preço, quem olhou, favoritou ou deixou no carrinho recebe um e-mail com foto e o “de/por”. No máximo 3 e-mails por mês.</p>
              </article>
              <article className="mk-tile wide dark mk-reveal">
                <span className="mk-ic blue">
                  <Icon name="chart" />
                </span>
                <h3>Meta Pixel + API de Conversões</h3>
                <p>Anúncios do Instagram e do Facebook otimizados com dados reais de compra, e a origem de cada pedido no painel.</p>
              </article>
              <article className="mk-tile mk-reveal">
                <span className="mk-ic amber">
                  <Icon name="card" />
                </span>
                <h3>Carrinho abandonado</h3>
                <p>Lembrete com fotos, “Lembrar todos” e WhatsApp com mensagem pronta.</p>
              </article>
              <article className="mk-tile mk-reveal">
                <span className="mk-ic violet">
                  <Icon name="zap" />
                </span>
                <h3>Cupons e promoções</h3>
                <p>Cupom por link e promoção relâmpago com início e fim.</p>
              </article>
              <article className="mk-tile mk-reveal">
                <span className="mk-ic green">
                  <Icon name="globe" />
                </span>
                <h3>Pronta para o Google</h3>
                <p>SEO de produto, sitemap e dados estruturados.</p>
              </article>
            </div>
          </div>
        </section>

        {/* Sua marca */}
        <section className="mk-dark mk-sec">
          <span className="mk-glow a" />
          <div className="mk-wrap">
            <div className="mk-split">
              <div className="mk-reveal">
                <span className="mk-kicker">100% a sua marca</span>
                <h2>Sua identidade em cada detalhe, sem escrever código</h2>
                <p>Logo, cores, banners, menu e textos ajustados pelo painel. Até os e-mails aos clientes saem com as cores da sua loja.</p>
                <ul className="mk-list">
                  <Item icon="settings" color="blue" title="Cor principal, dos botões e do menu" text="Com o contraste do texto ajustado sozinho." />
                  <Item icon="shield" color="green" title="LGPD e pagamento protegido" text="Banner de cookies e checkout seguro." />
                </ul>
              </div>
              <div className="mk-reveal">
                <BrandPreview />
              </div>
            </div>
          </div>
        </section>

        {/* Tudo incluso */}
        <section className="mk-sec soft" id="incluso">
          <div className="mk-wrap">
            <div className="mk-head mk-reveal">
              <span className="mk-kicker">Tudo incluso</span>
              <h2>Uma plataforma completa, sem pagar por plugins</h2>
            </div>
            <div className="mk-groups">
              {GROUPS.map((g) => (
                <div key={g.title} className="mk-group mk-reveal">
                  <h3>
                    <span className={`mk-ic ${g.color}`}>
                      <Icon name={g.icon} />
                    </span>
                    {g.title}
                  </h3>
                  <ul>
                    {g.items.map((t) => (
                      <li key={t}>
                        <Icon name="check" className="ico" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Dúvidas */}
        <section className="mk-sec">
          <div className="mk-wrap">
            <div className="mk-head mk-reveal">
              <span className="mk-kicker">Dúvidas</span>
              <h2>Perguntas frequentes</h2>
            </div>
            <Faq s={s} />
            <div style={{ maxWidth: 820, margin: "24px auto 0" }}>
              <HelpBox whatsapp={wa} />
            </div>
          </div>
        </section>

        {/* Chamada final */}
        <section className="mk-cta">
          <div className="mk-wrap">
            <div className="mk-cta-box mk-reveal">
              <span className="mk-glow a" />
              <span className="mk-glow b" />
              <h2>
                Quer uma loja assim para a <span className="mk-grad-text">sua marca</span>?
              </h2>
              <p>Escolha o plano e comece a vender em poucos dias, ou veja a plataforma funcionando ao vivo.</p>
              <div className="mk-ctas">
                <Link href="/planos" className="mk-btn glow">
                  Ver planos e assinar <Icon name="arrow" className="ico sm" />
                </Link>
                <a href={demo} className="mk-btn ghost-dark" target="_blank" rel="noopener noreferrer">
                  Quero uma demonstração
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
      <MarketingEffects whatsapp={wa} />
    </>
  );
}
