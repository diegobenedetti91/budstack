import Link from "next/link";
import { Logo } from "@/components/SiteChrome";
import { Icon } from "@/components/Icon";

// Estática de propósito: o Next usa esta página como fallback em todas as rotas geradas
// no build, então ela não pode consultar o banco (cabeçalho/rodapé completos consultam).
export default function NotFound() {
  return (
    <>
      <header className="header">
        <div className="wrap">
          <Logo />
          <div className="header-actions">
            <Link href="/entrar" className="btn btn-ghost btn-sm">
              Entrar
            </Link>
            <Link href="/planos" className="btn btn-primary btn-sm">
              Ver planos
            </Link>
          </div>
        </div>
      </header>
      <main className="sec soft" style={{ minHeight: "70vh" }}>
        <div className="wrap status-box">
          <div className="status-ic" style={{ background: "var(--blue-50)", color: "var(--blue)" }}>
            <Icon name="alert" />
          </div>
          <h1>Página não encontrada</h1>
          <p>O endereço pode ter mudado ou não existe mais.</p>
          <div className="ctas">
            <Link href="/" className="btn btn-primary">
              Ir para o início
            </Link>
            <Link href="/planos" className="btn btn-ghost">
              Ver planos
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
