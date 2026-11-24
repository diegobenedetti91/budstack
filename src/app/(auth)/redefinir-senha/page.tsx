import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "../forms";

export const metadata: Metadata = { title: "Nova senha", robots: { index: false } };

export default async function RedefinirPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <>
      <h1 className="auth2-title">Criar nova senha</h1>
      <p className="auth2-sub">Escolha uma senha com pelo menos 8 caracteres.</p>
      {token && /^[\w-]{20,100}$/.test(token) ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p className="muted">
          Link inválido.{" "}
          <Link href="/esqueci-senha" style={{ color: "var(--blue)", fontWeight: 600 }}>
            Peça um novo
          </Link>
          .
        </p>
      )}
    </>
  );
}
