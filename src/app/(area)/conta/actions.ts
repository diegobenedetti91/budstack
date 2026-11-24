"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { destroyOtherSessions, hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BillingError, cancelSubscription, payUrlFor, undoCancel } from "@/lib/billing";
import { isValidPhone } from "@/lib/validate";
import { onlyDigits } from "@/lib/format";
import type { ActionState } from "@/components/ActionForm";
import { normalizeCancelReason } from "@/lib/cancel-reasons";

async function run(fn: () => Promise<string>): Promise<ActionState> {
  try {
    const ok = await fn();
    revalidatePath("/conta");
    return { ok };
  } catch (e) {
    if (e instanceof BillingError) return { error: e.message };
    console.error("[conta]", e);
    return { error: "Não foi possível concluir agora. Tente de novo em instantes ou fale com a gente." };
  }
}

export async function cancelAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const fullReason = normalizeCancelReason(String(form.get("reason") ?? ""), String(form.get("other") ?? ""));
  return run(() => cancelSubscription(String(form.get("id") ?? ""), user.id, { refund: form.get("refund") === "on", reason: fullReason }));
}

export async function undoCancelAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  let target: string | undefined;
  const r = await run(async () => {
    const res = await undoCancel(String(form.get("id") ?? ""), user.id);
    target = res.redirect;
    return res.message;
  });
  if (r.ok && target) redirect(target);
  return r;
}

export async function payAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const what = form.get("what") === "domain" ? "domain" : "open";
  let url: string;
  try {
    url = await payUrlFor(String(form.get("id") ?? ""), user.id, what);
  } catch (e) {
    if (e instanceof BillingError) return { error: e.message };
    console.error("[conta] pagar:", e);
    return { error: "Não conseguimos abrir o pagamento agora. Tente de novo em instantes." };
  }
  redirect(url);
}

export async function saveProfileAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const name = String(form.get("name") ?? "").trim().replace(/\s+/g, " ");
  const phone = String(form.get("phone") ?? "");
  if (name.length < 3 || !name.includes(" ")) return { error: "Informe nome e sobrenome." };
  if (!isValidPhone(phone)) return { error: "WhatsApp com DDD, ex.: (19) 99999-9999." };
  await prisma.user.update({ where: { id: user.id }, data: { name: name.slice(0, 120), phone: onlyDigits(phone) } });
  revalidatePath("/conta", "layout");
  return { ok: "Dados salvos." };
}

export async function changePasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("password") ?? "");
  if (next.length < 8) return { error: "A nova senha precisa ter pelo menos 8 caracteres." };
  if (next !== String(form.get("confirm") ?? "")) return { error: "As senhas não conferem." };
  const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(current, row.passwordHash))) return { error: "A senha atual está incorreta." };
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  await destroyOtherSessions(user.id, true);
  return { ok: "Senha alterada. Outros aparelhos conectados foram desconectados." };
}
