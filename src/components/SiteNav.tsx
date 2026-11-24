"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";

interface Props {
  links: { href: string; label: string; external?: boolean }[];
  account: { href: string; label: string };
}

/** Navegação do site: links com a página atual destacada e menu de celular. */
export function SiteNav({ links, account }: Props) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

  // Fecha o menu ao trocar de página e com Esc; trava a rolagem enquanto aberto
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const item = (l: Props["links"][number]) =>
    l.external ? (
      <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer">
        {l.label}
      </a>
    ) : (
      <Link key={l.href} href={l.href} className={isActive(l.href) ? "on" : ""} aria-current={isActive(l.href) ? "page" : undefined}>
        {l.label}
      </Link>
    );

  return (
    <>
      <nav className="nav" aria-label="Principal">
        {links.map(item)}
      </nav>
      <div className="header-actions">
        <Link href={account.href} className="btn btn-ghost btn-sm">
          <Icon name="user" className="ico sm" />
          <span>{account.label}</span>
        </Link>
        <Link href="/planos" className="btn btn-primary btn-sm hide-md">
          Ver planos
        </Link>
        <button type="button" className="menu-btn" aria-label={open ? "Fechar menu" : "Abrir menu"} aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen((o) => !o)}>
          <Icon name={open ? "x" : "menu"} />
        </button>
      </div>
      <div id="mobile-menu" className={`mobile-menu${open ? " open" : ""}`} hidden={!open}>
        <nav aria-label="Menu">
          {links.map(item)}
        </nav>
        <Link href="/planos" className="btn btn-primary btn-block">
          Ver planos
        </Link>
      </div>
    </>
  );
}
