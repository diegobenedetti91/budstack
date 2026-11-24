import "server-only";
import { cache } from "react";
import { createHash, randomBytes } from "crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import type { User } from "@prisma/client";
import { prisma } from "./prisma";

// Login único para clientes e administrador (papel ADMIN vê o menu de Administração).
// O cookie guarda um token aleatório; no banco fica só o sha256 dele.

export const SESSION_COOKIE = "bs_session";
const SESSION_DAYS = 30;

export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
export const randomToken = () => randomBytes(32).toString("base64url");
export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export type SessionUser = Pick<User, "id" | "email" | "name" | "phone" | "document" | "role" | "createdAt">;

export async function createSession(userId: string): Promise<void> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  const ua = (await headers()).get("user-agent")?.slice(0, 200) ?? null;
  await prisma.session.create({ data: { id: sha256(token), userId, expiresAt, userAgent: ua } });
  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Encerra todas as sessões do usuário (ex.: depois de trocar a senha), menos a atual se informada. */
export async function destroyOtherSessions(userId: string, keepCurrent = true): Promise<void> {
  const token = keepCurrent ? (await cookies()).get(SESSION_COOKIE)?.value : undefined;
  await prisma.session.deleteMany({ where: { userId, ...(token ? { id: { not: sha256(token) } } : {}) } });
}

/** Usuário logado (ou null). Uma consulta por requisição. */
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await prisma.session.findUnique({
    where: { id: sha256(token) },
    include: { user: { select: { id: true, email: true, name: true, phone: true, document: true, role: true, createdAt: true, status: true } } },
  });
  if (!s || s.expiresAt < new Date() || s.user.status !== "ACTIVE") return null;
  const { status: _status, ...user } = s.user;
  return user;
});

export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect(`/entrar${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser("/admin");
  if (user.role !== "ADMIN") redirect("/conta");
  return user;
}

/** Destino seguro depois do login (só caminhos internos). */
export function safeNext(next: unknown, fallback: string): string {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : fallback;
}

// ───────── Limite de tentativas de login (no banco) ─────────

const WINDOW_MS = 15 * 60e3;
const LIMIT = { email: 5, ip: 30 };

/**
 * IP de quem fez a requisição. O primeiro valor do x-forwarded-for vem do navegador e pode ser forjado;
 * x-real-ip (definido pela hospedagem) ou o último salto do x-forwarded-for são os confiáveis.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  const hops = h.get("x-forwarded-for")?.split(",").map((x) => x.trim()).filter(Boolean) ?? [];
  return hops[hops.length - 1] ?? "local";
}

const keys = (email: string, ip: string) => [
  { key: `e:${email}`.slice(0, 191), limit: LIMIT.email },
  { key: `ip:${ip}`.slice(0, 191), limit: LIMIT.ip },
];

export async function loginBlocked(email: string, ip: string): Promise<boolean> {
  const rows = await prisma.loginAttempt.findMany({ where: { key: { in: keys(email, ip).map((k) => k.key) } } });
  const now = new Date();
  return keys(email, ip).some(({ key, limit }) => {
    const r = rows.find((x) => x.key === key);
    return !!r && r.count >= limit && r.until > now;
  });
}

export async function loginFailed(email: string, ip: string): Promise<void> {
  const now = new Date();
  await prisma.loginAttempt.deleteMany({ where: { until: { lt: now } } });
  for (const { key } of keys(email, ip)) {
    await prisma.loginAttempt.upsert({
      where: { key },
      create: { key, count: 1, until: new Date(now.getTime() + WINDOW_MS) },
      update: { count: { increment: 1 } },
    });
  }
}

/** Login certo zera as falhas da conta (as do IP continuam contando). */
export async function loginOk(email: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { key: `e:${email}`.slice(0, 191) } });
}
