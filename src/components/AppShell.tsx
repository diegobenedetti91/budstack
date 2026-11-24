"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";

export interface NavGroup {
  title: string;
  links: { href: string; label: string; icon: string; exact?: boolean }[];
}

interface Props {
  groups: NavGroup[];
  user: { name: string; email: string; admin: boolean };
  logout: () => Promise<void>;
  whatsapp: string;
  children: React.ReactNode;
}

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

/** Esqueleto da área logada (cliente e admin): menu lateral, barra superior e gaveta no celular. */
export function AppShell({ groups, user, logout, whatsapp, children }: Props) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(href + "/"));
  const active = groups.flatMap((g) => g.links.map((l) => ({ ...l, group: g.title }))).find((l) => isActive(l.href, l.exact));
  const inAdmin = path.startsWith("/admin");

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const sidebar = (
    <nav className="side" aria-label="Menu">
      <Link href={inAdmin ? "/admin" : "/conta"} className="side-brand">
        <span className="logo-mark">B</span>
        <span>
          <b>BudStack</b>
          <small>{inAdmin ? "Administração" : "Área do cliente"}</small>
        </span>
      </Link>

      <div className="side-groups">
        {groups.map((g) => (
          <div key={g.title} className="side-group">
            <span className="side-title">{g.title}</span>
            {g.links.map((l) => (
              <Link key={l.href} href={l.href} className={`side-link${isActive(l.href, l.exact) ? " on" : ""}`} aria-current={isActive(l.href, l.exact) ? "page" : undefined}>
                <Icon name={l.icon} className="ico" />
                <span>{l.label}</span>
              </Link>
            ))}
          </div>
        ))}

        {!user.admin && (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="side-help">
            <Icon name="msg" className="ico" />
            <b>Precisa de ajuda?</b>
            <span>Fale com a BudStack no WhatsApp.</span>
          </a>
        )}
      </div>

      <div className="side-user">
        <Link href="/conta/dados" className="avatar" aria-label="Meus dados">
          {initials(user.name)}
        </Link>
        <div className="side-user-info">
          <b>{user.name.split(" ")[0]}</b>
          <span>{user.email}</span>
        </div>
        <form action={logout}>
          <button className="icon-btn danger-hover" aria-label="Sair" title="Sair">
            <Icon name="logout" className="ico sm" />
          </button>
        </form>
      </div>
    </nav>
  );

  return (
    <div className="app">
      <aside className="app-side">{sidebar}</aside>
      <div className={`app-drawer${open ? " open" : ""}`} aria-hidden={!open}>
        <div className="app-backdrop" onClick={() => setOpen(false)} />
        <aside className="app-drawer-panel">
          <button className="icon-btn drawer-close" onClick={() => setOpen(false)} aria-label="Fechar menu">
            <Icon name="x" className="ico" />
          </button>
          {sidebar}
        </aside>
      </div>
      <div className="app-main">
        <header className="app-top">
          <button className="icon-btn app-menu" onClick={() => setOpen(true)} aria-label="Abrir menu" aria-expanded={open}>
            <Icon name="menu" className="ico" />
          </button>
          <nav className="crumbs" aria-label="Você está em">
            {active ? (
              <>
                <span className="muted hide-xs">{active.group}</span>
                <Icon name="chevron" className="ico xs muted hide-xs" />
                <b>{active.label}</b>
              </>
            ) : (
              <b>{inAdmin ? "Administração" : "Minha conta"}</b>
            )}
          </nav>
          <Link href="/" className="ui-btn ghost sm top-site" aria-label="Ver site">
            <Icon name="globe" className="ico sm" /> <span className="hide-xs">Ver site</span>
          </Link>
        </header>
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
