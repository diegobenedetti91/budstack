import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { logoutAction } from "../login/actions";

export const metadata: Metadata = { title: "Painel", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="admin-body">
      <header className="admin-top">
        <div className="wrap">
          <Link href="/admin" className="logo">
            <span className="logo-mark">B</span>
            <span>Painel</span>
          </Link>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/" className="btn btn-ghost btn-sm">
              Ver site
            </Link>
            <form action={logoutAction}>
              <button className="btn btn-ghost btn-sm">Sair</button>
            </form>
          </div>
        </div>
      </header>
      <main className="admin-main">
        <div className="wrap">{children}</div>
      </main>
    </div>
  );
}
