import Link from "next/link";
import { whatsappUrl } from "@/lib/format";
import { currentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="BudStack, página inicial">
      <span className="logo-mark">B</span>
      <span>BudStack</span>
    </Link>
  );
}

export async function SiteHeader() {
  const [user, s] = await Promise.all([currentUser(), getSettings()]);
  return (
    <header className="header">
      <div className="wrap">
        <Logo />
        <nav className="nav" aria-label="Principal">
          <Link href="/#produtos">Produtos</Link>
          <a href="/virtualstore">VirtualStore</a>
          <Link href="/planos">Planos</Link>
          <a href={whatsappUrl(s.contact_whatsapp, "Olá! Vim pelo site da BudStack.")} target="_blank" rel="noopener noreferrer">
            Contato
          </a>
        </nav>
        <div style={{ display: "flex", gap: 8 }}>
          {user ? (
            <Link href={user.role === "ADMIN" ? "/admin" : "/conta"} className="btn btn-ghost btn-sm">
              Minha conta
            </Link>
          ) : (
            <Link href="/entrar" className="btn btn-ghost btn-sm">
              Entrar
            </Link>
          )}
          <Link href="/planos" className="btn btn-primary btn-sm hide-sm">
            Ver planos
          </Link>
        </div>
      </div>
    </header>
  );
}

export async function SiteFooter() {
  const s = await getSettings();
  return (
    <footer className="site">
      <div className="wrap">
        <Logo />
        <span>© {new Date().getFullYear()} BudStack. Todos os direitos reservados.</span>
        <div className="links">
          <a href="/virtualstore">VirtualStore</a>
          <Link href="/planos">Planos</Link>
          <Link href="/entrar">Área do cliente</Link>
          {s.contact_instagram && (
            <a href={`https://www.instagram.com/${encodeURIComponent(s.contact_instagram)}`} target="_blank" rel="noopener noreferrer">
              Instagram
            </a>
          )}
          <a href={whatsappUrl(s.contact_whatsapp, "Olá! Vim pelo site da BudStack.")} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
        </div>
      </div>
    </footer>
  );
}
