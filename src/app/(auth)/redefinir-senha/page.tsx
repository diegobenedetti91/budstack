import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "../forms";

export const metadata: Metadata = { title: "Nova senha", robots: { index: false } };

export default async function RedefinirPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Criar nova senha</h1>
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
