"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  SESSION_HOURS,
  checkCredentials,
  clearFailedLogins,
  createSessionValue,
  loginBlocked,
  registerFailedLogin,
} from "@/lib/session";

async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || "local";
}

export async function loginAction(_prev: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const ip = await clientIp();
  if (loginBlocked(ip)) return { error: "Muitas tentativas. Aguarde 15 minutos e tente de novo." };

  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  if (!checkCredentials(email, password)) {
    registerFailedLogin(ip);
    return { error: "E-mail ou senha incorretos." };
  }

  clearFailedLogins(ip);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, createSessionValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  });
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/admin/login");
}
