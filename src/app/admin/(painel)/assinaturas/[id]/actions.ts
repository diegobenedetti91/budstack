"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { STAGES } from "@/lib/format";
import { reconcile } from "@/lib/subscriptions";

export async function updateStageAction(form: FormData): Promise<void> {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  const stage = String(form.get("stage") ?? "");
  const notes = String(form.get("notes") ?? "").slice(0, 5000);
  if (!STAGES.some((s) => s.id === stage)) return;
  await prisma.subscription.update({ where: { id }, data: { stage, notes: notes || null } });
  revalidatePath(`/admin/assinaturas/${id}`);
}

export async function reconcileAction(form: FormData): Promise<void> {
  await requireAdmin();
  const sub = await prisma.subscription.findUnique({ where: { id: String(form.get("id") ?? "") } });
  if (!sub) return;
  await reconcile(sub).catch((err) => console.error("[admin] conferir no MP:", err));
  revalidatePath(`/admin/assinaturas/${sub.id}`);
}
