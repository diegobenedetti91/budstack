import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, isValidSession } from "./session";

/** Garante que quem chama está logado no painel. Use em toda página e ação do admin. */
export async function requireAdmin(): Promise<void> {
  const jar = await cookies();
  if (!isValidSession(jar.get(SESSION_COOKIE)?.value)) redirect("/admin/login");
}
