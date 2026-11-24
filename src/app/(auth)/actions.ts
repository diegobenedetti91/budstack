"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  clientIp,
  createSession,
  destroyOtherSessions,
  destroySession,
  hashPassword,
  loginBlocked,
  loginFailed,
  loginOk,
  randomToken,
  safeNext,
  sha256,
  verifyPassword,
} from "@/lib/auth";
import { emailCustomer } from "@/lib/notify";

export interface FormState {
  error?: string;
  ok?: string;
  email?: string;
}

// Hash fixo para comparar quando o e-mail não existe (o tempo de resposta não revela se a conta existe)
const DUMMY_HASH = "$2b$12$JQqLC2KSI7JP7hI1VvgVyef.XbyJ1qWYwNId4d20be14wqDPTbK2.";

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = safeNext(form.get("next"), "");
  const ip = await clientIp();

  if (await loginBlocked(email, ip)) return { error: "Muitas tentativas. Aguarde 15 minutos e tente de novo.", email };
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || user.status !== "ACTIVE") {
    await loginFailed(email, ip);
    return { error: user?.status === "BLOCKED" && ok ? "Esta conta está bloqueada. Fale com a BudStack." : "E-mail ou senha incorretos.", email };
  }
  await loginOk(email);
  await createSession(user.id);
  redirect(next || (user.role === "ADMIN" ? "/admin" : "/conta"));
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/entrar");
}

export async function requestResetAction(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const ip = await clientIp();
  const done: FormState = { ok: "Se existir uma conta com este e-mail, enviamos um link para criar uma nova senha. Ele vale por 1 hora.", email };
  // Mesmo limite do login: evita usar o formulário para enviar e-mails em massa
  if (await loginBlocked(`reset:${email}`, ip)) return done;
  await loginFailed(`reset:${email}`, ip);

  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  if (user && user.status === "ACTIVE") {
    const token = randomToken();
    await prisma.passwordReset.create({ data: { id: sha256(token), userId: user.id, expiresAt: new Date(Date.now() + 3600e3) } });
    await emailCustomer(user.email, "Criar nova senha · BudStack", [
      "Criar uma nova senha",
      `Olá, ${user.name.split(" ")[0]}. Recebemos um pedido para criar uma nova senha na sua conta da BudStack.`,
      "O link abaixo vale por 1 hora. Se não foi você, ignore este e-mail: sua senha continua a mesma.",
    ], { label: "Criar nova senha", url: `/redefinir-senha?token=${token}` });
  }
  return done;
}

export async function resetPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password.length < 8) return { error: "A senha precisa ter pelo menos 8 caracteres." };
  if (password !== confirm) return { error: "As senhas não conferem." };

  const reset = token ? await prisma.passwordReset.findUnique({ where: { id: sha256(token) } }) : null;
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) return { error: "Este link expirou ou já foi usado. Peça um novo." };

  // Marca como usado de forma condicional: dois envios simultâneos não usam o mesmo link
  const { count } = await prisma.passwordReset.updateMany({ where: { id: reset.id, usedAt: null }, data: { usedAt: new Date() } });
  if (count !== 1) return { error: "Este link expirou ou já foi usado. Peça um novo." };
  await prisma.user.update({ where: { id: reset.userId }, data: { passwordHash: await hashPassword(password) } });
  await destroyOtherSessions(reset.userId, false);
  await createSession(reset.userId);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: reset.userId } });
  redirect(user.role === "ADMIN" ? "/admin" : "/conta");
}
