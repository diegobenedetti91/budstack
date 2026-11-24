import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { SETTING_CARDS } from "@/lib/settings-schema";
import { ActionForm } from "@/components/ActionForm";
import { saveSettingsAction } from "../actions";

export const metadata: Metadata = { title: "Configurações" };

export default async function ConfiguracoesPage() {
  const s = await getSettings();
  const env = {
    mp: !!process.env.MP_ACCESS_TOKEN,
    smtp: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    callmebot: !!(process.env.CALLMEBOT_PHONE && process.env.CALLMEBOT_APIKEY),
    cron: !!process.env.CRON_SECRET,
  };

  return (
    <>
      <h1>Configurações</h1>
      <p className="page-sub">Regras de cobrança, avisos e contato. Nada muda no site até você salvar.</p>

      <ActionForm action={saveSettingsAction} style={{ marginTop: 20 }}>
        {SETTING_CARDS.map((card) => (
          <section key={card.title} className="card">
            <h2 style={{ marginBottom: 4 }}>{card.title}</h2>
            {card.description && (
              <p className="muted" style={{ fontSize: 14, marginBottom: 16 }}>
                {card.description}
              </p>
            )}
            <div className="settings-grid">
              {card.fields.map((f) => {
                const value = s[f.key];
                if (f.kind === "toggle") {
                  return (
                    <div key={f.key} className="field">
                      <label className="switch">
                        <input type="checkbox" name={f.key} defaultChecked={!!value} /> {f.label}
                      </label>
                      {f.hint && <span className="hint">{f.hint}</span>}
                    </div>
                  );
                }
                const display = f.kind === "money" ? (Number(value) / 100).toFixed(2).replace(".", ",") : String(value ?? "");
                return (
                  <div key={f.key} className="field">
                    <label htmlFor={f.key}>
                      {f.label}
                      {f.suffix ? <span className="muted"> ({f.suffix})</span> : null}
                    </label>
                    <input
                      id={f.key}
                      name={f.key}
                      defaultValue={display}
                      type={f.kind === "int" ? "number" : f.kind === "email" ? "email" : "text"}
                      inputMode={f.kind === "money" ? "decimal" : f.kind === "phone" ? "tel" : undefined}
                      min={f.kind === "int" ? f.min : undefined}
                      max={f.kind === "int" ? f.max : undefined}
                    />
                    {f.hint && <span className="hint">{f.hint}</span>}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        <button className="btn btn-primary" style={{ marginTop: 6 }}>
          Salvar configurações
        </button>
      </ActionForm>

      <section className="card" style={{ marginTop: 24 }}>
        <h2 style={{ marginBottom: 4 }}>Integrações (variáveis de ambiente)</h2>
        <p className="muted" style={{ fontSize: 14, marginBottom: 14 }}>
          Chaves e senhas ficam nas variáveis do servidor (hPanel), não no banco. Aqui você só vê se estão configuradas.
        </p>
        <ul className="checks" style={{ marginTop: 0 }}>
          {[
            ["Mercado Pago (MP_ACCESS_TOKEN)", env.mp],
            ["E-mail (SMTP_HOST, SMTP_USER, SMTP_PASS)", env.smtp],
            ["WhatsApp (CALLMEBOT_PHONE, CALLMEBOT_APIKEY)", env.callmebot],
            ["Rotina diária de cobrança (CRON_SECRET)", env.cron],
          ].map(([label, ok]) => (
            <li key={String(label)}>
              <span className={`badge ${ok ? "green" : "red"}`}>{ok ? "Configurado" : "Faltando"}</span> {label}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
