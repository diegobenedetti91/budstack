"use server";

import { redirect } from "next/navigation";
import { getPlan, isCycle } from "@/lib/plans";
import { onlyDigits } from "@/lib/format";
import { isValidDocument, isValidEmail, isValidPhone, normalizeDomain } from "@/lib/validate";
import { startSubscription } from "@/lib/subscriptions";

export interface CheckoutState {
  error?: string;
  fields?: Partial<Record<"name" | "email" | "phone" | "document" | "storeName" | "domain" | "terms", string>>;
  values?: Record<string, string>;
}

export async function checkoutAction(_prev: CheckoutState, form: FormData): Promise<CheckoutState> {
  const v = (k: string) => String(form.get(k) ?? "").trim();
  const values = {
    plano: v("plano"),
    ciclo: v("ciclo"),
    name: v("name"),
    email: v("email").toLowerCase(),
    phone: v("phone"),
    document: v("document"),
    storeName: v("storeName"),
    domainOption: v("domainOption"),
    domain: v("domain"),
    terms: form.get("terms") === "on" ? "on" : "",
  };

  const plan = getPlan(values.plano);
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
  if (Object.keys(fields).length) return { error: "Confira os campos destacados.", fields, values };

  let payUrl: string;
  try {
    payUrl = await startSubscription({
      plan,
      cycle,
      customerName: values.name.replace(/\s+/g, " ").slice(0, 120),
      customerEmail: values.email,
      customerPhone: onlyDigits(values.phone),
      customerDocument: onlyDigits(values.document),
      storeName: values.storeName.replace(/\s+/g, " "),
      domainOption: domainOption!,
      domain: domain!,
    });
  } catch (err) {
    console.error("[assinar] falha ao iniciar pagamento:", err);
    return { error: "Não conseguimos abrir o pagamento agora. Tente de novo em instantes ou fale com a gente no WhatsApp.", values };
  }
  redirect(payUrl);
}
