import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Faq, HelpBox } from "@/components/Faq";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { PhoneMock } from "@/components/marketing/PhoneMock";
import { Marquee } from "@/components/marketing/Marquee";
import { PlanCards } from "@/components/marketing/PlanCards";
import { MarketingEffects } from "@/components/marketing/MarketingEffects";
import { getPlans } from "@/lib/plans";
import { getSettings } from "@/lib/settings";
import { money, whatsappUrl } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [plans, s] = await Promise.all([getPlans({ activeOnly: true }), getSettings()]);
  const fromPrice = plans.length ? Math.min(...plans.map((p) => p.monthlyCents)) : null;
  const wa = whatsappUrl(s.contact_whatsapp, "Olá! Vim pelo site da BudStack e quero saber mais sobre a VirtualStore.");

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
                <b>NOVO</b> IA 24h, cashback e aviso de novo pedido
              </span>
              <h1>
                Sua loja de moda <span className="mk-grad-text">vendendo 24h</span>, enquanto você cuida da marca.
              </h1>
              <p className="lead">Pagamento, nota fiscal, etiqueta, rastreio e atendimento acontecendo sozinhos. A BudStack monta e mantém a sua loja; você só embala e despacha.</p>
              <div className="mk-ctas">
                <Link href="/planos" className="mk-btn glow">
                  {fromPrice ? `Começar por ${money(fromPrice)}/mês` : "Ver planos"} <Icon name="arrow" className="ico sm" />
                </Link>
                <Link href="/virtualstore" className="mk-btn ghost-dark">
                  Ver tudo que ela faz
                </Link>
              </div>
              <ul className="mk-checks">
                <li>
                  <Icon name="check" className="ico sm" /> Implantação inclusa
                </li>
                <li>
                  <Icon name="check" className="ico sm" /> No ar em até {s.setup_business_days} dias úteis
                </li>
                <li>
                  <Icon name="check" className="ico sm" /> Sem fidelidade
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

        {/* Recursos em blocos */}
        <section className="mk-sec soft">
          <div className="mk-wrap">
            <div className="mk-head mk-reveal">
              <span className="mk-kicker">VirtualStore</span>
              <h2>Tudo que uma loja de moda precisa. Num só lugar.</h2>
              <p>Sem plugins, sem gambiarra, sem planilha. Cada recurso conversa com o outro.</p>
            </div>
            <div className="mk-bento">
              <article className="mk-tile wide grad mk-reveal">
                <span className="mk-ic glass">
                  <Icon name="card" />
                </span>
                <h3>Checkout que converte</h3>
                <p>Pix com desconto e cartão parcelado sem sair da loja, em 3 passos simples. Frete calculado pelo CEP na hora.</p>
                <div className="mk-chips">
                  <span>Pix</span>
                  <span>Cartão 12x</span>
                  <span>NuPay</span>
                  <span>WhatsApp</span>
                </div>
              </article>
              <article className="mk-tile wide dark mk-reveal">
                <span className="mk-ic blue">
                  <Icon name="bot" />
                </span>
                <h3>Atendimento com IA 24h</h3>
                <p>Responde tamanho, estoque e “onde está meu pedido?” de madrugada, e chama você no WhatsApp quando precisa.</p>
                <div className="mk-chips">
                  <span>Estoque por tamanho</span>
                  <span>Status do pedido</span>
                  <span>Resumo no WhatsApp</span>
                </div>
              </article>
              <article className="mk-tile mk-reveal">
                <span className="mk-ic green">
                  <Icon name="file" />
                </span>
                <h3>Nota fiscal sozinha</h3>
                <p>NF-e pelo Bling, autorizada na SEFAZ e enviada ao cliente.</p>
              </article>
              <article className="mk-tile mk-reveal">
                <span className="mk-ic violet">
                  <Icon name="truck" />
                </span>
                <h3>Etiqueta e rastreio</h3>
                <p>Etiqueta do Melhor Envio gerada e rastreio enviado ao cliente.</p>
              </article>
              <article className="mk-tile mk-reveal">
                <span className="mk-ic amber">
                  <Icon name="zap" />
                </span>
                <h3>Marketing que vende</h3>
                <p>Cashback, cupons, promoção relâmpago e carrinho abandonado.</p>
              </article>
            </div>
            <div style={{ textAlign: "center", marginTop: 28 }}>
              <Link href="/virtualstore" className="mk-btn ghost">
                Ver todos os recursos <Icon name="arrow" className="ico sm" />
              </Link>
            </div>
          </div>
        </section>

        {/* Automação */}
        <section className="mk-dark mk-sec">
          <span className="mk-glow c" />
          <div className="mk-wrap">
            <div className="mk-head mk-reveal">
              <span className="mk-kicker">Do clique à entrega</span>
              <h2>Cada venda segue sozinha.</h2>
              <p>O que tomava horas do seu dia agora acontece automaticamente, pedido por pedido.</p>
            </div>
            <div className="mk-flow">
              {[
                ["card", "blue", "Cliente compra", "Pix, cartão ou WhatsApp, com frete pelo CEP."],
                ["shield", "green", "Pagamento confirmado", "Você recebe o aviso na hora, com som."],
                ["file", "violet", "Nota emitida", "NF-e pelo Bling e DANFE por e-mail."],
                ["truck", "amber", "Etiqueta gerada", "Pronta para imprimir, com rastreio."],
                ["msg", "blue", "Cliente acompanha", "Rastreio e avisos a cada etapa."],
              ].map(([icon, color, t, d]) => (
                <div key={t} className="mk-step mk-reveal">
                  <span className={`mk-ic ${color}`}>
                    <Icon name={icon} />
                  </span>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              ))}
            </div>
            <p className="mk-banner mk-reveal">
              Você só <span className="mk-grad-text">embala e despacha</span>.
            </p>
          </div>
        </section>

        {/* Como funciona */}
        <section className="mk-sec" id="como-funciona">
          <div className="mk-wrap">
            <div className="mk-head mk-reveal">
              <span className="mk-kicker">Como funciona</span>
              <h2>Sua loja no ar em 3 passos</h2>
              <p>Você não precisa entender de tecnologia. A parte técnica é com a gente.</p>
            </div>
            <ol className="mk-steps3">
              <li className="mk-reveal">
                <span className="n">1</span>
                <h3>Escolha o plano</h3>
                <p>Assine em poucos minutos, no mensal ou no anual com desconto. Sem domínio? A gente registra.</p>
              </li>
              <li className="mk-reveal">
                <span className="n">2</span>
                <h3>Envie sua marca</h3>
                <p>Logo, cores e WhatsApp. Nós configuramos pagamentos, frete, nota fiscal e integrações.</p>
              </li>
              <li className="mk-reveal">
                <span className="n">3</span>
                <h3>Comece a vender</h3>
                <p>Em até {s.setup_business_days} dias úteis sua loja está no ar. Divulgue o link e acompanhe tudo pelo painel.</p>
              </li>
            </ol>
          </div>
        </section>

        {/* Planos */}
        {plans.length > 0 && (
          <section className="mk-dark mk-sec">
            <span className="mk-glow a" />
            <span className="mk-glow b" />
            <div className="mk-wrap">
              <div className="mk-head mk-reveal">
                <span className="mk-kicker">Planos</span>
                <h2>Escolha o tamanho do seu próximo passo</h2>
                <p>Implantação inclusa em todos. Cancele quando quiser, sem multa.</p>
              </div>
              <PlanCards plans={plans} cycle="MENSAL" s={s} limit={5} />
              <div style={{ textAlign: "center", marginTop: 28 }}>
                <Link href="/planos" className="mk-btn ghost-dark">
                  Comparar planos e ver o anual <Icon name="arrow" className="ico sm" />
                </Link>
              </div>
            </div>
          </section>
        )}

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
                Pronta para ter uma loja que <span className="mk-grad-text">trabalha por você</span>?
              </h2>
              <p>Escolha o plano, envie sua marca e comece a vender em poucos dias.</p>
              <div className="mk-ctas">
                <Link href="/planos" className="mk-btn glow">
                  Ver planos <Icon name="arrow" className="ico sm" />
                </Link>
                <a href={wa} className="mk-btn ghost-dark" target="_blank" rel="noopener noreferrer">
                  <Icon name="msg" className="ico sm" /> Falar no WhatsApp
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
