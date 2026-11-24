import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AreaNav, type NavGroup } from "@/components/AreaNav";
import { logoutAction } from "../(auth)/actions";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AreaLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const groups: NavGroup[] = [
    {
      title: "Minha conta",
      links: [
        { href: "/conta", label: "Assinaturas", exact: true },
        { href: "/conta/dados", label: "Meus dados" },
      ],
    },
  ];
  if (user.role === "ADMIN") {
    groups.push({
      title: "Administração",
      links: [
        { href: "/admin", label: "Visão geral", exact: true },
        { href: "/admin/clientes", label: "Clientes" },
        { href: "/admin/bi", label: "BI" },
        { href: "/admin/planos", label: "Planos e recursos" },
        { href: "/admin/configuracoes", label: "Configurações" },
      ],
    });
  }

  return (
    <div className="admin-body">
      <header className="admin-top">
        <div className="wrap">
          <Link href={user.role === "ADMIN" ? "/admin" : "/conta"} className="logo">
            <span className="logo-mark">B</span>
            <span>BudStack</span>
          </Link>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="muted area-user">{user.name.split(" ")[0]}</span>
            <Link href="/" className="btn btn-ghost btn-sm">
              Site
            </Link>
            <form action={logoutAction}>
              <button className="btn btn-ghost btn-sm">Sair</button>
            </form>
          </div>
        </div>
      </header>
      <div className="wrap area-grid">
        <AreaNav groups={groups} />
        <main className="area-main">{children}</main>
      </div>
    </div>
  );
}
