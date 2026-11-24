import type { Metadata } from "next";
import Link from "next/link";
import { RequestResetForm } from "../forms";

export const metadata: Metadata = { title: "Esqueci minha senha", robots: { index: false } };

export default function EsqueciPage() {
  return (
    <>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Esqueci minha senha</h1>
      <p className="muted" style={{ fontSize: 14.5, marginBottom: 20 }}>
        Informe o e-mail da sua conta. Enviaremos um link para criar uma nova senha.
      </p>
      <RequestResetForm />
      <p className="muted" style={{ fontSize: 14, textAlign: "center", marginTop: 16 }}>
        <Link href="/entrar" style={{ color: "var(--blue)", fontWeight: 600 }}>
          Voltar para o login
        </Link>
      </p>
    </>
  );
}
