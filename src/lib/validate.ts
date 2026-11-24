import { onlyDigits } from "./format";

export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 160;
}

/** Celular ou fixo brasileiro com DDD (10 ou 11 dígitos, aceitando o 55 na frente). */
export function isValidPhone(v: string): boolean {
  const d = onlyDigits(v).replace(/^55(?=\d{10,11}$)/, "");
  return d.length === 10 || d.length === 11;
}

export function isValidCpf(v: string): boolean {
  const d = onlyDigits(v);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

export function isValidCnpj(v: string): boolean {
  const d = onlyDigits(v);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((s, w, i) => s + Number(d[i]) * w, 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

export function isValidDocument(v: string): boolean {
  return isValidCpf(v) || isValidCnpj(v);
}

/**
 * Normaliza o domínio digitado: tira http(s)://, barras e espaços, deixa minúsculo.
 * Retorna null se não parecer um domínio (ex.: lojadacarla.com.br).
 */
export function normalizeDomain(raw: string): string | null {
  const d = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");
  if (d.length < 4 || d.length > 253) return null;
  const label = "[a-z0-9à-ÿ](?:[a-z0-9à-ÿ-]{0,61}[a-z0-9à-ÿ])?";
  const re = new RegExp(`^(?:${label}\\.)+[a-z]{2,24}$`);
  return re.test(d) ? d : null;
}
