import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { whatsappUrl } from "@/lib/format";
import { AppShell, type NavGroup } from "@/components/AppShell";
import { logoutAction } from "../(auth)/actions";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AreaLayout({ children }: { children: React.ReactNode }) {
  const [user, s] = await Promise.all([requireUser(), getSettings()]);
  const admin = user.role === "ADMIN";
  const groups: NavGroup[] = [];
  if (admin) {
    groups.push({
      title: "Administração",
      links: [
        { href: "/admin", label: "Visão geral", icon: "home", exact: true },
        { href: "/admin/clientes", label: "Clientes", icon: "users" },
        { href: "/admin/bi", label: "BI e análises", icon: "chart" },
        { href: "/admin/planos", label: "Planos e recursos", icon: "layers" },
        { href: "/admin/configuracoes", label: "Configurações", icon: "settings" },
      ],
    });
  }
  groups.push({
    title: "Minha conta",
    links: [
      { href: "/conta", label: admin ? "Minhas assinaturas" : "Assinatura", icon: "store", exact: true },
      { href: "/conta/dados", label: "Meus dados", icon: "user" },
    ],
  });

  return (
    <AppShell groups={groups} user={{ name: user.name, email: user.email, admin }} logout={logoutAction} whatsapp={whatsappUrl(s.contact_whatsapp, "Olá! Sou cliente da BudStack e preciso de ajuda.")}>
      {children}
    </AppShell>
  );
}
