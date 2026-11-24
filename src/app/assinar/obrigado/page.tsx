import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { Icon } from "@/components/Icon";
import { findByCode, reconcile } from "@/lib/subscriptions";
import { getPlan, SETUP_BUSINESS_DAYS } from "@/lib/plans";
import { cycleLabel, money, whatsappUrl } from "@/lib/format";
import { payDomainAction } from "./actions";

export const metadata: Metadata = { title: "Sua assinatura", robots: { index: false } };
export const dynamic = "force-dynamic";

const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP || "5519981687551";

export default async function ObrigadoPage({ searchParams }: { searchParams: Promise<{ pedido?: string; erro?: string }> }) {
  const sp = await searchParams;
  let sub = sp.pedido ? await findByCode(sp.pedido) : null;

  // Ao voltar do Mercado Pago, confere o pagamento na hora (sem esperar o aviso do Mercado Pago)
  if (sub && (sub.status === "PENDING" || (sub.domainOption === "REGISTER" && !sub.domainPaidAt))) {
    sub = await reconcile(sub).catch((err) => {
      console.error("[obrigado] conferência falhou:", err);
      return sub!;
    });
  }

  return (
    <>
      <SiteHeader />
      <main className="sec soft">
        <div className="wrap">{sub ? <Status sub={sub} domainError={sp.erro === "dominio"} /> : <NotFound />}</div>
      </main>
      <SiteFooter />
    </>
  );
}

function NotFound() {
  return (
    <div className="status-box">
      <div className="status-ic" style={{ background: "var(--amber-50)", color: "#9A5B00" }}>
        <Icon name="alert" />
      </div>
      <h1>Pedido não encontrado</h1>
      <p>Confira o link recebido por e-mail ou fale com a gente no WhatsApp.</p>
      <div className="ctas">
        <Link href="/planos" className="btn btn-ghost">
          Ver planos
        </Link>
      </div>
    </div>
  );
}

function Status({ sub, domainError }: { sub: NonNullable<Awaited<ReturnType<typeof findByCode>>>; domainError: boolean }) {
  const plan = getPlan(sub.plan);
  const first = sub.customerName.split(" ")[0];
  const help = whatsappUrl(WHATSAPP, `Olá! Sobre a minha assinatura ${sub.code} (${sub.storeName}).`);

  if (sub.status === "PENDING") {
    return (
      <div className="status-box">
        {/* Atualiza sozinho enquanto o pagamento não é confirmado (ex.: Pix aguardando) */}
        <meta httpEquiv="refresh" content="15" />
        <div className="status-ic" style={{ background: "var(--blue-50)", color: "var(--blue)" }}>
          <Icon name="clock" />
        </div>
        <h1>Aguardando a confirmação do pagamento</h1>
        <p>
          Pedido <b>{sub.code}</b>. Assim que o Mercado Pago confirmar, esta página atualiza sozinha e você recebe um e-mail. No Pix, costuma levar poucos segundos.
        </p>
        <div className="ctas">
          <a href={help} className="btn btn-ghost" target="_blank" rel="noopener noreferrer">
            <Icon name="msg" className="ico sm" /> Falar com a BudStack
          </a>
        </div>
      </div>
    );
  }

  if (sub.status === "CANCELLED") {
    return (
      <div className="status-box">
        <div className="status-ic" style={{ background: "var(--red-50)", color: "#B42318" }}>
          <Icon name="alert" />
        </div>
        <h1>Esta assinatura não está ativa</h1>
        <p>O pagamento do pedido {sub.code} não foi concluído ou foi cancelado. Você pode assinar de novo ou falar com a gente.</p>
        <div className="ctas">
          <Link href="/planos" className="btn btn-primary">
            Ver planos
          </Link>
          <a href={help} className="btn btn-ghost" target="_blank" rel="noopener noreferrer">
            Falar com a BudStack
          </a>
        </div>
      </div>
    );
  }

  const domainPending = sub.domainOption === "REGISTER" && !sub.domainPaidAt;
  return (
    <div className="status-box">
      <div className="status-ic" style={{ background: "var(--green-50)", color: "var(--green)" }}>
        <Icon name="check" />
      </div>
      <h1>Tudo certo, {first}! Sua assinatura está ativa.</h1>
      <p>
        Plano <b>{plan?.name ?? sub.plan}</b> ({cycleLabel(sub.cycle)}) da VirtualStore · pedido <b>{sub.code}</b>. Enviamos a confirmação para o seu e-mail.
      </p>

      {domainPending && (
        <div className="card" style={{ marginTop: 26, textAlign: "left" }}>
          {domainError && <div className="alert error">Não conseguimos abrir o pagamento do domínio. Tente de novo ou fale com a gente.</div>}
          <h2 style={{ marginBottom: 8 }}>Falta pagar o registro do domínio</h2>
          <p className="muted" style={{ marginBottom: 16 }}>
            Para registrarmos <b style={{ color: "var(--ink)" }}>{sub.domain}</b> em seu nome, pague a taxa de {money(sub.domainFeeCents)} (1 ano) no Pix ou cartão.
          </p>
          <form action={payDomainAction}>
            <input type="hidden" name="pedido" value={sub.code} />
            <button className="btn btn-primary btn-block">Pagar registro do domínio · {money(sub.domainFeeCents)}</button>
          </form>
        </div>
      )}

      <ol className="steps" style={{ padding: 0 }}>
        <li>
          <span className="n">1</span>
          <div>
            <b>Envie os materiais da loja</b>
            <span>Responda o e-mail de confirmação com o logo (PNG), as cores da marca e o WhatsApp de atendimento.</span>
          </div>
        </li>
        <li>
          <span className="n">2</span>
          <div>
            <b>{sub.domainOption === "OWN" ? `Apontamos o domínio ${sub.domain}` : `Registramos o domínio ${sub.domain}`}</b>
            <span>{sub.domainOption === "OWN" ? "Te enviamos o passo a passo para apontar o seu domínio para a loja." : "Se ele não estiver disponível, combinamos outra opção com você antes."}</span>
          </div>
        </li>
        <li>
          <span className="n">3</span>
          <div>
            <b>Sua loja {sub.storeName} no ar</b>
            <span>Em até {SETUP_BUSINESS_DAYS} dias úteis após recebermos os materiais, com pagamentos e frete configurados.</span>
          </div>
        </li>
      </ol>
      <div className="ctas">
        <a href={help} className="btn btn-ghost" target="_blank" rel="noopener noreferrer">
          <Icon name="msg" className="ico sm" /> Falar com a BudStack
        </a>
      </div>
    </div>
  );
}
