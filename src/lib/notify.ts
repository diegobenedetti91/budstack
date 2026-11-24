import "server-only";
import nodemailer from "nodemailer";
import type { Subscription } from "@prisma/client";
import { getPlan, SETUP_BUSINESS_DAYS } from "./plans";
import { cycleLabel, formatDocument, formatPhone, money, priceSuffix } from "./format";
import { siteUrl } from "./mercadopago";

// Avisos de nova assinatura: e-mail e WhatsApp para você, e-mail de confirmação para o cliente.
// Cada canal falha sozinho, sem derrubar os outros nem o webhook.

function escapeHtml(v: string): string {
  return v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function transport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  const port = Number(SMTP_PORT || 465);
  return nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
}

async function sendEmail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const t = transport();
  if (!t) {
    console.warn("[notify] SMTP não configurado; e-mail não enviado:", subject);
    return false;
  }
  await t.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, html, text });
  return true;
}

async function sendWhatsApp(text: string): Promise<boolean> {
  const phone = process.env.CALLMEBOT_PHONE;
  const apikey = process.env.CALLMEBOT_APIKEY;
  if (!phone || !apikey) {
    console.warn("[notify] CallMeBot não configurado; WhatsApp não enviado");
    return false;
  }
  const q = new URLSearchParams({ phone, text, apikey });
  const res = await fetch(`https://api.callmebot.com/whatsapp.php?${q}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`CallMeBot ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return true;
}

function domainLine(s: Subscription): string {
  if (s.domainOption === "OWN") return `Já tem domínio: ${s.domain}`;
  const paid = s.domainPaidAt ? "taxa paga" : "taxa ainda NÃO paga";
  return `NÃO tem domínio. Registrar para o cliente: ${s.domain} (${money(s.domainFeeCents)}, ${paid})`;
}

function planLine(s: Subscription): string {
  const plan = getPlan(s.plan);
  return `${plan?.name ?? s.plan} (${cycleLabel(s.cycle)}) · ${money(s.planPriceCents)}${priceSuffix(s.cycle)}`;
}

export function ownerMessage(s: Subscription): string {
  return [
    "Nova assinatura paga — VirtualStore",
    "",
    `Plano: ${planLine(s)}`,
    `Valor recebido: ${money(s.totalCents)}`,
    `Pedido: ${s.code}`,
    "",
    `Loja: ${s.storeName}`,
    `Domínio: ${domainLine(s)}`,
    "",
    `Cliente: ${s.customerName}`,
    `E-mail: ${s.customerEmail}`,
    `WhatsApp: ${formatPhone(s.customerPhone)}`,
    `CPF/CNPJ: ${formatDocument(s.customerDocument)}`,
    "",
    `Painel: ${siteUrl()}/admin/assinaturas/${s.id}`,
  ].join("\n");
}

/** Avisa você (e-mail + WhatsApp) e confirma ao cliente. Retorna true se ao menos um aviso seu saiu. */
export async function notifyPaid(s: Subscription): Promise<boolean> {
  const text = ownerMessage(s);
  const html = `<pre style="font:14px/1.5 system-ui,sans-serif;white-space:pre-wrap">${escapeHtml(text)}</pre>`;
  const owner = process.env.NOTIFY_EMAIL;

  const results = await Promise.allSettled([
    owner ? sendEmail(owner, `Nova assinatura paga: ${s.storeName} · ${planLine(s)}`, html, text) : Promise.resolve(false),
    sendWhatsApp(text),
    sendCustomerConfirmation(s),
  ]);
  results.forEach((r, i) => {
    if (r.status === "rejected") console.error(`[notify] canal ${["e-mail", "whatsapp", "cliente"][i]} falhou:`, r.reason);
  });
  return results.slice(0, 2).some((r) => r.status === "fulfilled" && r.value === true);
}

/** Aviso curto quando a taxa do domínio (plano mensal) é paga depois da assinatura. */
export async function notifyDomainPaid(s: Subscription): Promise<void> {
  const text = `Taxa de domínio paga — ${s.storeName}\nRegistrar: ${s.domain}\nPedido: ${s.code}\nPainel: ${siteUrl()}/admin/assinaturas/${s.id}`;
  const owner = process.env.NOTIFY_EMAIL;
  const results = await Promise.allSettled([
    owner ? sendEmail(owner, `Taxa de domínio paga: ${s.domain}`, `<pre style="font:14px/1.5 system-ui,sans-serif">${escapeHtml(text)}</pre>`, text) : Promise.resolve(false),
    sendWhatsApp(text),
  ]);
  results.forEach((r) => r.status === "rejected" && console.error("[notify] aviso de domínio falhou:", r.reason));
}

async function sendCustomerConfirmation(s: Subscription): Promise<boolean> {
  const plan = getPlan(s.plan);
  const first = escapeHtml(s.customerName.split(" ")[0]);
  const domainHtml =
    s.domainOption === "OWN"
      ? `Vamos usar o seu domínio <b>${escapeHtml(s.domain)}</b>. Vamos te passar como apontá-lo para a loja.`
      : s.domainPaidAt
        ? `Vamos registrar o domínio <b>${escapeHtml(s.domain)}</b> para você.`
        : `Para registrarmos o domínio <b>${escapeHtml(s.domain)}</b>, falta pagar a taxa de registro na página do seu pedido.`;
  const html = `
  <div style="font:15px/1.6 system-ui,sans-serif;color:#0B1324;max-width:560px">
    <h2 style="margin:0 0 12px">Pagamento confirmado, ${first}!</h2>
    <p>Sua assinatura do plano <b>${escapeHtml(plan?.name ?? s.plan)}</b> (${cycleLabel(s.cycle)}) da VirtualStore está ativa. Pedido <b>${s.code}</b>.</p>
    <p>${domainHtml}</p>
    <p><b>Próximos passos:</b> responda este e-mail com o logo da loja (PNG), as cores da marca e o WhatsApp de atendimento. Com isso em mãos, sua loja <b>${escapeHtml(s.storeName)}</b> fica no ar em até ${SETUP_BUSINESS_DAYS} dias úteis.</p>
    <p>Acompanhe o pedido em <a href="${siteUrl()}/assinar/obrigado?pedido=${s.code}">${siteUrl()}/assinar/obrigado?pedido=${s.code}</a>.</p>
    <p style="color:#64748B;font-size:13px">BudStack · VirtualStore</p>
  </div>`;
  const text = `Pagamento confirmado! Plano ${plan?.name ?? s.plan} (${cycleLabel(s.cycle)}), pedido ${s.code}. Responda este e-mail com o logo, as cores e o WhatsApp da loja. Sua loja fica no ar em até ${SETUP_BUSINESS_DAYS} dias úteis.`;
  return sendEmail(s.customerEmail, `Pagamento confirmado · VirtualStore ${plan?.name ?? ""}`.trim(), html, text);
}
