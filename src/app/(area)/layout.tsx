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
        { href: "/conta", label: "Assinaturas", icon: "card", exact: true },
        { href: "/conta/dados", label: "Meus dados", icon: "user" },
      ],
    },
  ];
  if (user.role === "ADMIN") {
    groups.push({
      title: "Administração",
      links: [
        { href: "/admin", label: "Visão geral", icon: "home", exact: true },
        { href: "/admin/clientes", label: "Clientes", icon: "users" },
        { href: "/admin/bi", label: "BI", icon: "chart" },
        { href: "/admin/planos", label: "Planos e recursos", icon: "layers" },
        { href: "/admin/configuracoes", label: "Configurações", icon: "settings" },
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
            <span className="area-user" title={user.email}>
              <span className="avatar" aria-hidden="true">
                {user.name
                  .split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((w) => w[0]!.toUpperCase())
                  .join("")}
              </span>
              <span className="area-user-name">{user.name.split(" ")[0]}</span>
            </span>
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
