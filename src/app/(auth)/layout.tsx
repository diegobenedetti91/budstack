import Link from "next/link";
import { Icon } from "@/components/Icon";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth">
      <aside className="auth-brand" aria-hidden="true">
        <Link href="/" className="logo logo-light" tabIndex={-1}>
          <span className="logo-mark">B</span>
          <span>BudStack</span>
        </Link>
        <div>
          <h2>Sua loja, seus pagamentos e sua assinatura em um só lugar.</h2>
          <ul>
            <li>
              <Icon name="check" className="ico sm" /> Acompanhe a assinatura e os pagamentos
            </li>
            <li>
              <Icon name="check" className="ico sm" /> Pague a renovação ou o domínio com um clique
            </li>
            <li>
              <Icon name="check" className="ico sm" /> Cancele quando quiser, sem multa
            </li>
          </ul>
        </div>
        <span className="auth-foot">BudStack · VirtualStore</span>
      </aside>
      <div className="auth-main">
        <div className="login-card">
          <Link href="/" className="logo auth-logo-sm" aria-label="BudStack, página inicial">
            <span className="logo-mark">B</span>
            <span>BudStack</span>
          </Link>
          <div className="card">{children}</div>
          <p className="muted" style={{ fontSize: 13.5, textAlign: "center", marginTop: 16 }}>
            Ainda não é cliente?{" "}
            <Link href="/planos" style={{ color: "var(--blue)", fontWeight: 700 }}>
              Conheça os planos
            </Link>
            {" · "}
            <Link href="/" style={{ color: "var(--ink-2)", fontWeight: 600 }}>
              Voltar ao site
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
