import Link from "next/link";
import { Icon } from "@/components/Icon";
import { HeroVisual } from "@/components/HeroVisual";
import { Faq, HelpBox } from "@/components/Faq";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getPlans } from "@/lib/plans";
import { getSettings } from "@/lib/settings";
import { money, whatsappUrl } from "@/lib/format";

export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: "card", title: "Pix e cartão na loja", text: "Checkout em 3 passos, Pix com desconto e cartão parcelado sem sair do site." },
  { icon: "file", title: "Nota fiscal automática", text: "A NF-e sai pelo Bling e vai por e-mail para o cliente assim que o pagamento é aprovado." },
  { icon: "truck", title: "Etiqueta e rastreio", text: "Frete pelo CEP, etiqueta do Melhor Envio gerada sozinha e rastreio enviado ao cliente." },
  { icon: "bot", title: "Atendimento com IA 24h", text: "Responde dúvidas de tamanho, estoque e pedidos a qualquer hora e chama você quando precisa." },
  { icon: "zap", title: "Marketing que vende", text: "Cashback, cupons, promoções relâmpago e recuperação de carrinho abandonado." },
  { icon: "chart", title: "Lucro de verdade", text: "Painel com faturamento, lucro real, funil de vendas e de onde vêm seus clientes." },
] as const;

export default async function Home() {
  const [plans, s] = await Promise.all([getPlans({ activeOnly: true }), getSettings()]);
  const fromPrice = plans.length ? Math.min(...plans.map((p) => p.monthlyCents)) : null;
  const wa = whatsappUrl(s.contact_whatsapp, "Olá! Vim pelo site da BudStack e quero saber mais sobre a VirtualStore.");

  return (
    <>
      <SiteHeader />
      <main>
        {/* Hero */}
        <section className="hero hero-split">
          <div className="wrap hero-grid">
            <div className="enter">
              <span className="eyebrow">
                <b>VirtualStore</b> A loja virtual completa para moda
              </span>
              <h1>
                Sua marca <span className="grad-text">vendendo online</span>, sem dor de cabeça.
              </h1>
              <p className="lead">
                A BudStack cria e mantém a sua loja virtual: pagamento, nota fiscal, etiqueta, atendimento e relatórios funcionando juntos. Você cuida das peças; a tecnologia fica com a gente.
              </p>
              <div className="ctas">
                <Link href="/planos" className="btn btn-primary">
                  {fromPrice ? `Começar por ${money(fromPrice)}/mês` : "Ver planos"} <Icon name="arrow" className="ico sm" />
                </Link>
                <a href="/virtualstore" className="btn btn-ghost">
                  Conhecer a VirtualStore
                </a>
              </div>
              <ul className="hero-checks">
                <li>
                  <Icon name="check" className="ico sm" /> Implantação inclusa
                </li>
                <li>
                  <Icon name="check" className="ico sm" /> Loja no ar em até {s.setup_business_days} dias úteis
                </li>
                <li>
                  <Icon name="check" className="ico sm" /> Cancele quando quiser
                </li>
              </ul>
            </div>
            <div className="enter enter-2">
              <HeroVisual />
            </div>
          </div>
          <div className="wrap strip">
            <p>Integrado com quem você já usa</p>
            <ul>
              {["Mercado Pago", "Pix", "NuPay", "InfinitePay", "Melhor Envio", "Correios", "Bling", "Meta Ads", "Google", "WhatsApp"].map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* Recursos */}
        <section className="sec soft" id="produtos">
          <div className="wrap">
            <div className="sec-head">
              <span className="kicker">VirtualStore</span>
              <h2>Tudo que uma loja de moda precisa, em um só lugar</h2>
              <p>Do clique à entrega, cada etapa acontece sozinha. Você só embala e despacha.</p>
            </div>
            <div className="features">
              {FEATURES.map((f) => (
                <article key={f.title} className="feature">
                  <span className="feature-ic">
                    <Icon name={f.icon} />
                  </span>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </article>
              ))}
            </div>
            <div className="center" style={{ marginTop: 32 }}>
              <a href="/virtualstore" className="btn btn-ghost">
                Ver todos os recursos <Icon name="arrow" className="ico sm" />
              </a>
            </div>
          </div>
        </section>

        {/* Como funciona */}
        <section className="sec" id="como-funciona">
          <div className="wrap">
            <div className="sec-head">
              <span className="kicker">Como funciona</span>
              <h2>Sua loja no ar em 3 passos</h2>
              <p>Sem precisar entender de tecnologia. A gente faz a parte técnica com você.</p>
            </div>
            <ol className="how">
              <li>
                <span className="how-n">1</span>
                <h3>Escolha o plano</h3>
                <p>Assine pelo site em poucos minutos, no mensal ou no anual com desconto. Já tem domínio? Ótimo. Não tem? A gente registra.</p>
              </li>
              <li>
                <span className="how-n">2</span>
                <h3>Envie sua marca</h3>
                <p>Logo, cores e WhatsApp de atendimento. Nós configuramos pagamentos, frete, nota fiscal e integrações.</p>
              </li>
              <li>
                <span className="how-n">3</span>
                <h3>Comece a vender</h3>
                <p>Em até {s.setup_business_days} dias úteis sua loja está no ar. Cadastre as peças, divulgue o link e acompanhe tudo pelo painel.</p>
              </li>
            </ol>
          </div>
        </section>

        {/* Planos (prévia) */}
        {plans.length > 0 && (
          <section className="sec soft">
            <div className="wrap">
              <div className="sec-head">
                <span className="kicker">Planos</span>
                <h2>Um plano para cada momento da sua marca</h2>
                <p>Implantação inclusa em todos. No anual, {12 - s.annual_months_charged > 0 ? `${12 - s.annual_months_charged} meses grátis` : "pagamento único"}.</p>
              </div>
              <div className="plan-teasers">
                {plans.map((p) => (
                  <Link key={p.id} href={`/planos#${p.id}`} className={`plan-teaser${p.highlight ? " hl" : ""}`}>
                    {p.highlight && <span className="badge-top">Mais escolhido</span>}
                    <b>{p.name}</b>
                    <span className="muted">{p.tagline}</span>
                    <span className="teaser-price">
                      {money(p.monthlyCents)}
                      <small>/mês</small>
                    </span>
                    <span className="teaser-link">
                      Ver o que inclui <Icon name="arrow" className="ico sm" />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* FAQ */}
        <section className="sec">
          <div className="wrap">
            <div className="sec-head">
              <span className="kicker">Dúvidas</span>
              <h2>Perguntas frequentes</h2>
            </div>
            <Faq s={s} />
            <div style={{ maxWidth: 820, margin: "24px auto 0" }}>
              <HelpBox whatsapp={wa} />
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="cta">
          <div className="wrap">
            <div className="cta-box">
              <h2>Pronta para ter uma loja que trabalha por você?</h2>
              <p>Escolha o plano, envie sua marca e comece a vender em poucos dias.</p>
              <div className="ctas">
                <Link href="/planos" className="btn btn-white">
                  Ver planos <Icon name="arrow" className="ico sm" />
                </Link>
                <a href={wa} className="btn btn-outline-w" target="_blank" rel="noopener noreferrer">
                  <Icon name="msg" className="ico sm" /> Falar no WhatsApp
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
