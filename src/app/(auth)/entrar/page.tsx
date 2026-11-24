import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser, safeNext } from "@/lib/auth";
import { LoginForm } from "../forms";

export const metadata: Metadata = { title: "Entrar", robots: { index: false } };

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const user = await currentUser();
  if (user) redirect(safeNext(next, user.role === "ADMIN" ? "/admin" : "/conta"));
  return (
    <>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Entrar</h1>
      <p className="muted" style={{ fontSize: 14.5, marginBottom: 20 }}>
        Acompanhe sua assinatura, seus pagamentos e a sua loja.
      </p>
      <LoginForm next={safeNext(next, "")} />
    </>
  );
}
