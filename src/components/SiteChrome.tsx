import Link from "next/link";
import { whatsappUrl } from "@/lib/format";

const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP || "5519981687551";

export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="BudStack, página inicial">
      <span className="logo-mark">B</span>
      <span>BudStack</span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="header">
      <div className="wrap">
        <Logo />
        <nav className="nav" aria-label="Principal">
          <Link href="/#produtos">Produtos</Link>
          <a href="/virtualstore">VirtualStore</a>
          <Link href="/planos">Planos</Link>
          <a href={whatsappUrl(WHATSAPP, "Olá! Vim pelo site da BudStack.")} target="_blank" rel="noopener noreferrer">
            Contato
          </a>
        </nav>
        <Link href="/planos" className="btn btn-primary btn-sm">
          Ver planos
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site">
      <div className="wrap">
        <Logo />
        <span>© {new Date().getFullYear()} BudStack. Todos os direitos reservados.</span>
        <div className="links">
          <a href="/virtualstore">VirtualStore</a>
          <Link href="/planos">Planos</Link>
          <a href="https://www.instagram.com/budstack.tech" target="_blank" rel="noopener noreferrer">
            Instagram
          </a>
          <a href={whatsappUrl(WHATSAPP, "Olá! Vim pelo site da BudStack.")} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
        </div>
      </div>
    </footer>
  );
}
