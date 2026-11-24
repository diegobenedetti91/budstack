import { createHash, createHmac, timingSafeEqual } from "crypto";

// Sessão do painel: cookie com "validade.assinatura" (HMAC-SHA256 com SESSION_SECRET).
// Não guarda dados no servidor; para derrubar todas as sessões, troque o SESSION_SECRET.

export const SESSION_COOKIE = "bs_admin";
export const SESSION_HOURS = 8;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET ausente ou curto (use openssl rand -hex 32)");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(`admin:${payload}`).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  // Compara digests de tamanho fixo para não vazar o tamanho do valor esperado
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function createSessionValue(now = Date.now()): string {
  const exp = String(now + SESSION_HOURS * 60 * 60 * 1000);
  return `${exp}.${sign(exp)}`;
}

export function isValidSession(value: string | undefined | null, now = Date.now()): boolean {
  if (!value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp)) return false;
  if (Number(exp) < now) return false;
  try {
    return safeEqual(sig, sign(exp));
  } catch {
    return false;
  }
}

/** Confere e-mail e senha com ADMIN_EMAIL / ADMIN_PASSWORD. */
export function checkCredentials(email: string, password: string): boolean {
  const expectedEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const expectedPass = process.env.ADMIN_PASSWORD || "";
  if (!expectedEmail || expectedPass.length < 10) {
    console.error("[admin] ADMIN_EMAIL/ADMIN_PASSWORD não configurados (senha precisa de 10+ caracteres)");
    return false;
  }
  // Avalia as duas comparações sempre, para o tempo não indicar qual errou
  const emailOk = safeEqual(email.trim().toLowerCase(), expectedEmail);
  const passOk = safeEqual(password, expectedPass);
  return emailOk && passOk;
}

// Limite simples de tentativas por IP (um processo Node; zera ao reiniciar).
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export function loginBlocked(ip: string, now = Date.now()): boolean {
  const a = attempts.get(ip);
  return !!a && a.until > now && a.count >= MAX_ATTEMPTS;
}

export function registerFailedLogin(ip: string, now = Date.now()): void {
  const a = attempts.get(ip);
  if (!a || a.until < now) attempts.set(ip, { count: 1, until: now + WINDOW_MS });
  else a.count++;
}

export function clearFailedLogins(ip: string): void {
  attempts.delete(ip);
}
