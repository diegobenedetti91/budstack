import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { SETTING_SECTIONS } from "@/lib/settings-schema";
import { SettingsForm } from "@/components/SettingsForm";
import { PageHeader } from "@/components/ui";
import { saveSettingsAction } from "../actions";

export const metadata: Metadata = { title: "Configurações" };

export default async function ConfiguracoesPage() {
  const s = await getSettings();
  const env = process.env;
  const integrations = [
    { label: "Mercado Pago", vars: "MP_ACCESS_TOKEN", ok: !!env.MP_ACCESS_TOKEN },
    { label: "E-mail (SMTP)", vars: "SMTP_HOST · SMTP_USER · SMTP_PASS", ok: !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) },
    { label: "WhatsApp (CallMeBot)", vars: "CALLMEBOT_PHONE · CALLMEBOT_APIKEY", ok: !!(env.CALLMEBOT_PHONE && env.CALLMEBOT_APIKEY) },
    { label: "Rotina diária de cobrança", vars: "CRON_SECRET", ok: !!env.CRON_SECRET },
  ];

  return (
    <>
      <PageHeader title="Configurações" subtitle="Cobrança, cancelamento, pausa, avisos e contato. Nada muda no site até você salvar." />
      <SettingsForm sections={SETTING_SECTIONS} values={s} integrations={integrations} action={saveSettingsAction} />
    </>
  );
}
