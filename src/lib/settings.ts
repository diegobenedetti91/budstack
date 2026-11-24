import "server-only";
import { cache } from "react";
import { prisma } from "./prisma";
import { DEFAULT_SETTINGS, SETTING_FIELDS, type SettingKey, type Settings } from "./settings-schema";

/** Configurações atuais (banco por cima dos padrões). Uma leitura por requisição. */
export const getSettings = cache(async (): Promise<Settings> => {
  const rows = await prisma.setting.findMany();
  const out: Settings = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    if (!(r.key in DEFAULT_SETTINGS)) continue;
    try {
      (out as Record<string, unknown>)[r.key] = JSON.parse(r.value);
    } catch {}
  }
  return out;
});

/** Valida e converte um valor vindo do formulário. Retorna erro em texto se inválido. */
export function parseSetting(key: SettingKey, raw: FormDataEntryValue | null): { value: unknown } | { error: string } {
  const f = SETTING_FIELDS.find((x) => x.key === key);
  if (!f) return { error: "Configuração desconhecida." };
  const s = String(raw ?? "").trim();
  switch (f.kind) {
    case "toggle":
      return { value: raw === "on" };
    case "int":
    case "money": {
      const n = f.kind === "money" ? Math.round(Number(s.replace(/\./g, "").replace(",", ".")) * 100) : Number(s);
      if (!Number.isFinite(n) || (f.kind === "int" && !Number.isInteger(n))) return { error: `${f.label}: número inválido.` };
      const min = f.min ?? -Infinity;
      const max = f.max ?? Infinity;
      if (n < min || n > max) return { error: `${f.label}: use entre ${f.kind === "money" ? (min / 100).toFixed(2) : min} e ${f.kind === "money" ? (max / 100).toFixed(2) : max}.` };
      return { value: n };
    }
    case "email":
      if (s && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) return { error: `${f.label}: e-mail inválido.` };
      return { value: s.toLowerCase() };
    case "phone": {
      const d = s.replace(/\D/g, "");
      if (d && (d.length < 12 || d.length > 13)) return { error: `${f.label}: use DDI + DDD + número, ex.: 5519999999999.` };
      return { value: d };
    }
    default:
      return { value: s.replace(/^@/, "").slice(0, 120) };
  }
}

export async function saveSettings(values: Partial<Settings>): Promise<void> {
  await prisma.$transaction(
    Object.entries(values).map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, create: { key, value: JSON.stringify(value) }, update: { value: JSON.stringify(value) } }),
    ),
  );
}
