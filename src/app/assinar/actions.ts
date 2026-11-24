"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, currentUser, hashPassword } from "@/lib/auth";
import { getPlan, isCycle } from "@/lib/plans";
import { onlyDigits } from "@/lib/format";
import { isValidDocument, isValidEmail, isValidPhone, normalizeDomain } from "@/lib/validate";
import { startSubscription } from "@/lib/billing";

type FieldKey = "name" | "email" | "phone" | "document" | "storeName" | "domain" | "terms" | "password";

export interface CheckoutState {
  error?: string;
  loginUrl?: string;
  fields?: Partial<Record<FieldKey, string>>;
  values?: Record<string, string>;
}

export async function checkoutAction(_prev: CheckoutState, form: FormData): Promise<CheckoutState> {
  const user = await currentUser();
  const v = (k: string) => String(form.get(k) ?? "").trim();
  const values = {
    plano: v("plano"),
    ciclo: v("ciclo"),
    name: v("name"),
    email: (user?.email ?? v("email")).toLowerCase(),
    phone: v("phone"),
    document: v("document"),
    storeName: v("storeName"),
    domainOption: v("domainOption"),
    domain: v("domain"),
    terms: form.get("terms") === "on" ? "on" : "",
  };

  const plan = await getPlan(values.plano, { activeOnly: true });
  const cycle = values.ciclo.toUpperCase();
  if (!plan || !isCycle(cycle)) return { error: "Plano inválido. Volte e escolha o plano de novo.", values };

  const fields: CheckoutState["fields"] = {};
  if (values.name.length < 3 || !values.name.includes(" ")) fields.name = "Informe nome e sobrenome.";
  if (!isValidEmail(values.email)) fields.email = "E-mail inválido.";
  if (!isValidPhone(values.phone)) fields.phone = "WhatsApp com DDD, ex.: (19) 99999-9999.";
  if (!isValidDocument(values.document)) fields.document = "CPF ou CNPJ inválido.";
  if (values.storeName.length < 2 || values.storeName.length > 80) fields.storeName = "Informe o nome da loja.";
  const domainOption = values.domainOption === "OWN" ? "OWN" : values.domainOption === "REGISTER" ? "REGISTER" : null;
  const domain = normalizeDomain(values.domain);
  if (!domainOption) fields.domain = "Diga se você já tem domínio.";
  else if (!domain) fields.domain = domainOption === "OWN" ? "Informe o seu domínio, ex.: minhaloja.com.br" : "Informe o domínio que você quer, ex.: minhaloja.com.br";
  if (form.get("terms") !== "on") fields.terms = "É preciso aceitar as condições.";

  const password = String(form.get("password") ?? "");
  if (!user) {
    if (password.length < 8) fields.password = "Crie uma senha com pelo menos 8 caracteres.";
    else if (password !== String(form.get("confirm") ?? "")) fields.password = "As senhas não conferem.";
  }
  if (Object.keys(fields).length) return { error: "Confira os campos destacados.", fields, values };

  // Conta: logado usa a própria; senão cria (e-mail já cadastrado precisa entrar antes)
  let userId = user?.id;
  if (!userId) {
    const exists = await prisma.user.findUnique({ where: { email: values.email } });
    if (exists) {
      return {
        error: "Já existe uma conta com este e-mail. Entre para continuar a assinatura.",
        loginUrl: `/entrar?next=${encodeURIComponent(`/assinar?plano=${plan.id}&ciclo=${values.ciclo}`)}`,
        fields: { email: "E-mail já cadastrado." },
        values,
      };
    }
    const created = await prisma.user.create({
      data: {
        email: values.email,
        name: values.name.replace(/\s+/g, " ").slice(0, 120),
        phone: onlyDigits(values.phone),
        document: onlyDigits(values.document),
        passwordHash: await hashPassword(password),
      },
    });
    userId = created.id;
    await createSession(userId);
  } else {
    // Completa o cadastro de quem já tem conta (telefone/documento vazios)
    await prisma.user.update({
      where: { id: userId },
      data: { phone: user!.phone || onlyDigits(values.phone), document: user!.document || onlyDigits(values.document) },
    });
  }

  const jar = await cookies();
  let src: { source?: string; medium?: string | null; campaign?: string | null } = {};
  try {
    src = JSON.parse(jar.get("bs_src")?.value ?? "{}") ?? {};
  } catch {}

  let payUrl: string;
  try {
    payUrl = await startSubscription({
      userId,
      plan,
      cycle,
      customerName: values.name.replace(/\s+/g, " ").slice(0, 120),
      customerEmail: values.email,
      customerPhone: onlyDigits(values.phone),
      customerDocument: onlyDigits(values.document),
      storeName: values.storeName.replace(/\s+/g, " "),
      domainOption: domainOption!,
      domain: domain!,
      attribution: {
        visitorId: jar.get("bs_vid")?.value?.slice(0, 40) ?? null,
        source: typeof src.source === "string" ? src.source.slice(0, 60) : "direto",
        medium: typeof src.medium === "string" ? src.medium.slice(0, 60) : null,
        campaign: typeof src.campaign === "string" ? src.campaign.slice(0, 120) : null,
      },
    });
  } catch (err) {
    console.error("[assinar] falha ao iniciar pagamento:", err);
    return { error: "Não conseguimos abrir o pagamento agora. Sua conta foi criada: tente de novo em instantes pela sua área de cliente ou fale com a gente.", values };
  }
  redirect(payUrl);
}
