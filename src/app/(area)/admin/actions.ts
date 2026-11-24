"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseSetting, saveSettings } from "@/lib/settings";
import { SETTING_FIELDS, type Settings } from "@/lib/settings-schema";
import { STAGES } from "@/lib/format";
import { BillingError, cancelSubscription, reconcile } from "@/lib/billing";
import { normalizeCancelReason } from "@/lib/cancel-reasons";
import type { ActionState } from "@/components/ActionForm";

const parseMoney = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim().replace(/[R$\s]/g, "");
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};

const slugify = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

function refreshPublic() {
  revalidatePath("/", "layout");
}

// ───────── Planos ─────────

export async function savePlanAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const tagline = String(form.get("tagline") ?? "").trim();
  const monthlyCents = parseMoney(form.get("price"));
  const sort = Number(form.get("sort") ?? 0);
  if (name.length < 2 || name.length > 60) return { error: "Nome do plano: de 2 a 60 caracteres." };
  if (tagline.length > 255) return { error: "Descrição muito longa." };
  if (!Number.isFinite(monthlyCents) || monthlyCents < 100 || monthlyCents > 10_000_00) return { error: "Preço mensal inválido (entre R$ 1,00 e R$ 10.000,00)." };
  const data = { name, tagline, monthlyCents, highlight: form.get("highlight") === "on", active: form.get("active") === "on", sort: Number.isFinite(sort) ? Math.trunc(sort) : 0 };

  if (id) {
    await prisma.plan.update({ where: { id }, data });
  } else {
    const slug = slugify(name);
    if (!slug) return { error: "Nome do plano inválido." };
    if (await prisma.plan.findUnique({ where: { id: slug } })) return { error: "Já existe um plano com esse nome." };
    await prisma.plan.create({ data: { id: slug, ...data } });
  }
  // Só um plano em destaque
  if (data.highlight) await prisma.plan.updateMany({ where: { id: { not: id || slugify(name) } }, data: { highlight: false } });
  refreshPublic();
  return { ok: id ? "Plano salvo. Quem já assinou continua com o preço da compra." : "Plano criado." };
}

export async function deletePlanAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  const used = await prisma.subscription.count({ where: { plan: id } });
  if (used) return { error: `Este plano tem ${used} assinatura(s). Desative-o em vez de apagar.` };
  await prisma.plan.delete({ where: { id } }).catch(() => null);
  refreshPublic();
  return { ok: "Plano apagado." };
}

// ───────── Recursos × planos ─────────

export async function saveFeaturesAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const [plans, features] = await Promise.all([prisma.plan.findMany({ select: { id: true } }), prisma.feature.findMany()]);
  const ops = [];
  const links: { planId: string; featureId: string }[] = [];

  for (const f of features) {
    if (form.get(`del_${f.id}`) === "on") {
      ops.push(prisma.feature.delete({ where: { id: f.id } }));
      continue;
    }
    const name = String(form.get(`name_${f.id}`) ?? f.name).trim().slice(0, 160);
    const sort = Number(form.get(`sort_${f.id}`) ?? f.sort);
    if (!name) return { error: "Todo recurso precisa de um nome (ou marque para apagar)." };
    ops.push(prisma.feature.update({ where: { id: f.id }, data: { name, sort: Number.isFinite(sort) ? Math.trunc(sort) : f.sort, active: form.get(`active_${f.id}`) === "on" } }));
    for (const p of plans) if (form.get(`pf_${p.id}_${f.id}`) === "on") links.push({ planId: p.id, featureId: f.id });
  }

  const newName = String(form.get("new_name") ?? "").trim().slice(0, 160);
  await prisma.$transaction([...ops, prisma.planFeature.deleteMany({}), prisma.planFeature.createMany({ data: links })]);
  if (newName) {
    const max = await prisma.feature.aggregate({ _max: { sort: true } });
    const created = await prisma.feature.create({ data: { name: newName, sort: (max._max.sort ?? 0) + 1 } });
    const newLinks = plans.filter((p) => form.get(`pfnew_${p.id}`) === "on").map((p) => ({ planId: p.id, featureId: created.id }));
    if (newLinks.length) await prisma.planFeature.createMany({ data: newLinks });
  }
  refreshPublic();
  return { ok: newName ? "Recursos salvos e novo recurso adicionado." : "Recursos salvos." };
}

// ───────── Configurações ─────────

export async function saveSettingsAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const values: Partial<Settings> = {};
  const errors: string[] = [];
  for (const f of SETTING_FIELDS) {
    const r = parseSetting(f.key, form.get(f.key));
    if ("error" in r) errors.push(r.error);
    else (values as Record<string, unknown>)[f.key] = r.value;
  }
  if (errors.length) return { error: errors.join(" ") };
  await saveSettings(values);
  refreshPublic();
  return { ok: "Configurações salvas." };
}

// ───────── Clientes ─────────

export async function updateStageAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  const stage = String(form.get("stage") ?? "");
  const notes = String(form.get("notes") ?? "").slice(0, 5000);
  if (!STAGES.some((s) => s.id === stage)) return { error: "Etapa inválida." };
  await prisma.subscription.update({ where: { id }, data: { stage, notes: notes || null } });
  revalidatePath(`/admin/clientes/${id}`);
  return { ok: "Implantação atualizada." };
}

export async function reconcileAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const sub = await prisma.subscription.findUnique({ where: { id: String(form.get("id") ?? "") } });
  if (!sub) return { error: "Assinatura não encontrada." };
  try {
    const after = await reconcile(sub);
    revalidatePath(`/admin/clientes/${sub.id}`);
    return { ok: after.status === sub.status ? "Conferido: nada mudou no Mercado Pago." : "Conferido e atualizado com o Mercado Pago." };
  } catch (err) {
    console.error("[admin] conferir no MP:", err);
    return { error: "Não foi possível consultar o Mercado Pago agora." };
  }
}

export async function adminCancelAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  try {
    const msg = await cancelSubscription(id, null, { refund: form.get("refund") === "on", reason: normalizeCancelReason(String(form.get("reason") ?? ""), "") || "Cancelado pelo administrador" });
    revalidatePath(`/admin/clientes/${id}`);
    return { ok: msg };
  } catch (e) {
    if (e instanceof BillingError) return { error: e.message };
    console.error("[admin] cancelar:", e);
    return { error: "Não foi possível cancelar agora." };
  }
}

export async function toggleUserBlockAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  const userId = String(form.get("userId") ?? "");
  if (userId === me.id) return { error: "Você não pode bloquear a si mesmo." };
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) return { error: "Usuário não encontrado." };
  const status = u.status === "BLOCKED" ? "ACTIVE" : "BLOCKED";
  await prisma.user.update({ where: { id: userId }, data: { status } });
  if (status === "BLOCKED") await prisma.session.deleteMany({ where: { userId } });
  revalidatePath("/admin/clientes", "layout");
  return { ok: status === "BLOCKED" ? "Acesso do cliente bloqueado." : "Acesso do cliente liberado." };
}
