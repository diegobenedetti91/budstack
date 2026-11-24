import type { Metadata } from "next";
import { Logo } from "@/components/SiteChrome";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Entrar no painel", robots: { index: false, follow: false } };

export default function LoginPage() {
  return (
    <main className="login-wrap">
      <div className="login-card">
        <Logo />
        <div className="card">
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Painel BudStack</h1>
          <p className="muted" style={{ fontSize: 14.5, marginBottom: 20 }}>
            Entre para ver as assinaturas e as implantações.
          </p>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
