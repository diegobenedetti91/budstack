import Link from "next/link";
import { Icon } from "@/components/Icon";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getPlans } from "@/lib/plans";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const plans = await getPlans({ activeOnly: true });
  const fromPrice = plans.length ? Math.min(...plans.map((p) => p.monthlyCents)) : null;
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero">
          <div className="wrap">
            <span className="kicker">BudStack</span>
            <h1>
              Tecnologia para a sua marca <span className="grad-text">vender online</span> sem complicação.
            </h1>
            <p className="lead">
              Criamos e mantemos a sua loja virtual, do pagamento à entrega. Você cuida dos produtos e dos clientes; a tecnologia fica com a gente.
            </p>
            <div className="ctas">
              <Link href="/planos" className="btn btn-primary">
                Ver planos <Icon name="arrow" className="ico sm" />
              </Link>
              <a href="/virtualstore" className="btn btn-ghost">
                Conhecer a VirtualStore
              </a>
            </div>
          </div>
        </section>

        <section className="sec soft" id="produtos">
          <div className="wrap">
            <div className="sec-head">
              <span className="kicker">Nossos produtos</span>
              <h2>Soluções prontas para vender mais</h2>
              <p>Plataformas completas, com a sua marca, implantadas e mantidas pela nossa equipe.</p>
            </div>

            <article className="product">
              <div className="info">
                <span className="tag">
                  <Icon name="bag" className="ico sm" /> Loja virtual para moda
                </span>
                <h3>VirtualStore</h3>
                <p>A loja virtual que recebe o pagamento, emite a nota, gera a etiqueta, avisa o cliente e mostra o seu lucro real.</p>
                <ul className="checks">
                  {[
                    "Pix e cartão sem sair da loja, frete calculado pelo CEP",
                    "Nota fiscal e etiqueta de envio automáticas",
                    "Atendimento com IA 24h e aviso de novo pedido",
                    "Cashback, cupons, promoções e carrinho abandonado",
                    "Painel com lucro real, funil e relatórios",
                  ].map((t) => (
                    <li key={t}>
                      <Icon name="check" className="ico sm" />
                      {t}
                    </li>
                  ))}
                </ul>
                <div className="ctas" style={{ justifyContent: "flex-start" }}>
                  <Link href="/planos" className="btn btn-primary">
                    {fromPrice ? `Planos a partir de ${money(fromPrice)}/mês` : "Ver planos"}
                  </Link>
                  <a href="/virtualstore" className="btn btn-ghost">
                    Ver todos os recursos
                  </a>
                </div>
              </div>
              <div className="side" aria-hidden="true">
                <div className="stat">
                  <b>Do clique à entrega</b>
                  <span>Pagamento, nota fiscal, etiqueta e rastreio em sequência, sem trabalho manual.</span>
                </div>
                <div className="stat">
                  <b>100% a sua marca</b>
                  <span>Logo, cores, domínio e e-mails com a identidade da sua loja.</span>
                </div>
                <div className="stat">
                  <b>Implantação inclusa</b>
                  <span>Configuramos pagamentos, frete e integrações com você.</span>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="sec">
          <div className="wrap">
            <div className="sec-head">
              <span className="kicker">Por que a BudStack</span>
              <h2>Você vende, a gente cuida da tecnologia</h2>
            </div>
            <div className="values">
              <div className="value">
                <div className="ic">
                  <Icon name="users" />
                </div>
                <h3>Implantação feita com você</h3>
                <p>Montamos a loja com a sua marca, pagamentos, frete e integrações. Você não precisa entender de tecnologia.</p>
              </div>
              <div className="value">
                <div className="ic">
                  <Icon name="globe" />
                </div>
                <h3>Domínio e hospedagem</h3>
                <p>Usamos o seu domínio ou registramos um novo para você. A loja fica no ar com segurança (https).</p>
              </div>
              <div className="value">
                <div className="ic">
                  <Icon name="zap" />
                </div>
                <h3>Sempre evoluindo</h3>
                <p>Novos recursos chegam à sua loja sem custo extra dentro do seu plano.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
