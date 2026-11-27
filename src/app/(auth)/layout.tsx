import Link from "next/link";
import { Icon } from "@/components/Icon";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth2">
      <aside className="auth2-brand" aria-hidden="true">
        <span className="glow g1" />
        <span className="glow g2" />
        <Link href="/" className="auth2-logo" tabIndex={-1}>
          <span className="logo-mark">B</span>
          <span>
            Bud<b>Stack</b>
          </span>
        </Link>
        <div className="auth2-copy">
          <h2>Sua loja no ar, sua assinatura sob controle.</h2>
          <p>Acompanhe pagamentos, pause quando precisar e cancele sem burocracia. Tudo em um só lugar.</p>
          <ul>
            {["Assinatura, cobranças e histórico", "Pausa, troca de plano e cancelamento", "Pix, boleto ou cartão com pagamento seguro"].map((t) => (
              <li key={t}>
                <Icon name="check" className="ico sm" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="auth2-foot">© {new Date().getFullYear()} BudStack · VirtualStore</p>
      </aside>
      <main className="auth2-main">
        <div className="auth2-box">
          <Link href="/" className="auth2-logo dark mobile-only" aria-label="BudStack, página inicial">
            <span className="logo-mark">B</span>
            <span>
              Bud<b>Stack</b>
            </span>
          </Link>
          {children}
          <p className="auth2-alt">
            Ainda não é cliente? <Link href="/planos">Conheça os planos</Link> · <Link href="/">Voltar ao site</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
