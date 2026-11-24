import type { Metadata } from "next";
import Link from "next/link";
import { RequestResetForm } from "../forms";

export const metadata: Metadata = { title: "Esqueci minha senha", robots: { index: false } };

export default function EsqueciPage() {
  return (
    <>
      <h1 className="auth2-title">Esqueci minha senha</h1>
      <p className="auth2-sub">Informe o e-mail da sua conta. Enviaremos um link para criar uma nova senha.</p>
      <RequestResetForm />
      <p className="muted" style={{ fontSize: 14, textAlign: "center", marginTop: 16 }}>
        <Link href="/entrar" style={{ color: "var(--blue)", fontWeight: 600 }}>
          Voltar para o login
        </Link>
      </p>
    </>
  );
}
