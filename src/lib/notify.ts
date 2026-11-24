import "server-only";
import nodemailer from "nodemailer";
import type { Subscription } from "@prisma/client";
import { getSettings } from "./settings";
import { cycleLabel, formatDocument, formatPhone, money, priceSuffix } from "./format";
import { siteUrl } from "./mercadopago";

// Avisos: para você (e-mail + WhatsApp) e para o cliente (e-mail).
// Cada canal falha sozinho, sem derrubar os outros nem a operação que chamou.

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

/** Aviso para você. Retorna true se ao menos um canal entregou. */
export async function notifyOwner(subject: string, text: string): Promise<boolean> {
  const s = await getSettings();
  const to = s.notify_email || process.env.NOTIFY_EMAIL || "";
  const html = `<pre style="font:14px/1.5 system-ui,sans-serif;white-space:pre-wrap">${escapeHtml(text)}</pre>`;
  const results = await Promise.allSettled([
    to ? sendEmail(to, subject, html, text) : Promise.resolve(false),
    s.notify_whatsapp ? sendWhatsApp(`${subject}\n\n${text}`) : Promise.resolve(false),
  ]);
  results.forEach((r, i) => r.status === "rejected" && console.error(`[notify] ${i ? "whatsapp" : "e-mail"} falhou:`, r.reason));
  return results.some((r) => r.status === "fulfilled" && r.value === true);
}

/** E-mail para o cliente: parágrafos simples e, opcionalmente, um botão. Texto é escapado. */
export async function emailCustomer(to: string, subject: string, paragraphs: string[], cta?: { label: string; url: string }): Promise<boolean> {
  const url = cta ? (cta.url.startsWith("http") ? cta.url : `${siteUrl()}${cta.url}`) : "";
  const html = `
  <div style="font:15px/1.6 system-ui,sans-serif;color:#0B1324;max-width:560px">
    ${paragraphs.map((p, i) => (i === 0 ? `<h2 style="margin:0 0 12px;font-size:20px">${escapeHtml(p)}</h2>` : `<p>${escapeHtml(p)}</p>`)).join("")}
    ${cta ? `<p style="margin:24px 0"><a href="${escapeHtml(url)}" style="background:#2F5BFF;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:700">${escapeHtml(cta.label)}</a></p>` : ""}
    <p style="color:#64748B;font-size:13px">BudStack · VirtualStore</p>
  </div>`;
  const text = [...paragraphs, cta ? `${cta.label}: ${url}` : ""].filter(Boolean).join("\n\n");
  try {
    return await sendEmail(to, subject, html, text);
  } catch (err) {
    console.error("[notify] e-mail ao cliente falhou:", subject, err);
    return false;
  }
}

// ───────── Mensagens sobre assinaturas ─────────

function domainLine(s: Subscription): string {
  if (s.domainOption === "OWN") return `Já tem domínio: ${s.domain}`;
  return `NÃO tem domínio. Registrar para o cliente: ${s.domain} (${money(s.domainFeeCents)}, ${s.domainPaidAt ? "taxa paga" : "taxa ainda NÃO paga"})`;
}

export function subscriptionSummary(s: Subscription, planName: string): string {
  return [
    `Plano: ${planName} (${cycleLabel(s.cycle)}) · ${money(s.planPriceCents)}${priceSuffix(s.cycle)}`,
    `Pedido: ${s.code}`,
    `Loja: ${s.storeName}`,
    `Domínio: ${domainLine(s)}`,
    `Cliente: ${s.customerName}`,
    `E-mail: ${s.customerEmail}`,
    `WhatsApp: ${formatPhone(s.customerPhone)}`,
    `CPF/CNPJ: ${formatDocument(s.customerDocument)}`,
    s.source ? `Origem: ${[s.source, s.medium, s.campaign].filter(Boolean).join(" / ")}` : "",
    "",
    `Painel: ${siteUrl()}/admin/clientes/${s.id}`,
  ]
    .filter((l, i, a) => l !== "" || a[i - 1] !== "")
    .join("\n");
}

/** Nova assinatura paga: avisa você e dá as boas-vindas ao cliente. */
export async function notifyNewPaid(s: Subscription, planName: string): Promise<boolean> {
  const settings = await getSettings();
  const owner = notifyOwner(`Nova assinatura paga: ${s.storeName} · ${planName} (${cycleLabel(s.cycle)})`, `Valor recebido: ${money(s.totalCents)}\n${subscriptionSummary(s, planName)}`);
  const first = s.customerName.split(" ")[0];
  const domain =
    s.domainOption === "OWN"
      ? `Vamos usar o seu domínio ${s.domain} e te passar como apontá-lo para a loja.`
      : s.domainPaidAt
        ? `Vamos registrar o domínio ${s.domain} para você.`
        : `Para registrarmos o domínio ${s.domain}, falta pagar a taxa de registro na sua área de cliente.`;
  await emailCustomer(
    s.customerEmail,
    `Pagamento confirmado · VirtualStore ${planName}`,
    [
      `Pagamento confirmado, ${first}!`,
      `Sua assinatura do plano ${planName} (${cycleLabel(s.cycle)}) da VirtualStore está ativa. Pedido ${s.code}.`,
      domain,
      `Próximos passos: responda este e-mail com o logo da loja (PNG), as cores da marca e o WhatsApp de atendimento. Com isso em mãos, sua loja ${s.storeName} fica no ar em até ${settings.setup_business_days} dias úteis.`,
      "Na sua área de cliente você acompanha a assinatura, os pagamentos e pode cancelar quando quiser.",
    ],
    { label: "Ver minha assinatura", url: "/conta" },
  );
  return owner;
}
