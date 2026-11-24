"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { SettingField, SettingSection, Settings } from "@/lib/settings-schema";
import type { ActionState } from "./ActionForm";
import { Icon } from "./Icon";

interface Props {
  sections: SettingSection[];
  values: Settings;
  integrations: { label: string; vars: string; ok: boolean }[];
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
}

function display(f: SettingField, v: unknown): string {
  if (f.kind === "money") return (Number(v) / 100).toFixed(2).replace(".", ",");
  return String(v ?? "");
}

function FieldInput({ f, value }: { f: SettingField; value: unknown }) {
  if (f.kind === "toggle") {
    return (
      <div className="cfg-toggle">
        <div>
          <b>{f.label}</b>
          {f.hint && <span>{f.hint}</span>}
        </div>
        <span className="ui-switch">
          <input type="checkbox" name={f.key} defaultChecked={!!value} aria-label={f.label} />
          <i />
        </span>
      </div>
    );
  }
  return (
    <div className="field">
      <label htmlFor={f.key}>{f.label}</label>
      <div className="ui-affix">
        {f.prefix && <span className="pre">{f.prefix}</span>}
        <input
          id={f.key}
          name={f.key}
          defaultValue={display(f, value)}
          className={[f.prefix ? "has-pre" : "", f.suffix ? "has-suf" : ""].join(" ")}
          type={f.kind === "int" ? "number" : f.kind === "email" ? "email" : "text"}
          inputMode={f.kind === "money" ? "decimal" : f.kind === "phone" ? "tel" : undefined}
          min={f.kind === "int" ? f.min : undefined}
          max={f.kind === "int" ? f.max : undefined}
        />
        {f.suffix && <span className="suf">{f.suffix}</span>}
      </div>
      {f.hint && <span className="hint">{f.hint}</span>}
    </div>
  );
}

/** Configurações: seções à esquerda, campos à direita e barra de salvar fixa (estilo Saldo Livre). */
export function SettingsForm({ sections, values, integrations, action }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const [current, setCurrent] = useState(sections[0]?.key ?? "");
  const [dirty, setDirty] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const missing = integrations.filter((i) => !i.ok).length;

  useEffect(() => {
    if (state.ok) setDirty(false);
  }, [state]);

  // Aviso ao sair da página com mudanças não salvas
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  const nav = [...sections.map((s) => ({ key: s.key, label: s.label, hint: s.hint, icon: s.icon })), { key: "integracoes", label: "Integrações", hint: "Chaves no servidor", icon: "lock" }];

  return (
    <form ref={form} action={formAction} onChange={() => setDirty(true)} onReset={() => setDirty(false)}>
      {state.error && (
        <div className="alert error" role="alert" style={{ marginBottom: 16 }}>
          {state.error}
        </div>
      )}
      <div className="cfg">
        <nav className="cfg-nav" aria-label="Seções">
          {nav.map((s) => (
            <button key={s.key} type="button" className={current === s.key ? "on" : ""} onClick={() => setCurrent(s.key)} aria-current={current === s.key ? "true" : undefined}>
              <Icon name={s.icon} className="ico sm" />
              <span style={{ flex: 1, minWidth: 0 }}>
                <b>{s.label}</b>
                <small>{s.hint}</small>
              </span>
              {s.key === "integracoes" && missing > 0 && <span className="ui-badge warn">{missing}</span>}
            </button>
          ))}
        </nav>

        <div>
          {/* Todas as seções ficam no formulário (só a atual aparece), para salvar tudo de uma vez */}
          {sections.map((s) => (
            <div key={s.key} className={`cfg-section${current === s.key ? " on" : ""}`}>
              {s.cards.map((c) => (
                <section key={c.title} className="ui-card">
                  <div className="ui-card-head">
                    <div className="ui-card-title">
                      <span className="ui-chip">
                        <Icon name={s.icon} className="ico sm" />
                      </span>
                      <div>
                        <h3>{c.title}</h3>
                        {c.description && <p>{c.description}</p>}
                      </div>
                    </div>
                  </div>
                  <div className="cfg-fields">
                    {c.fields.map((f) => (
                      <FieldInput key={f.key} f={f} value={values[f.key]} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ))}
          <div className={`cfg-section${current === "integracoes" ? " on" : ""}`}>
            <section className="ui-card">
              <div className="ui-card-head">
                <div className="ui-card-title">
                  <span className="ui-chip">
                    <Icon name="lock" className="ico sm" />
                  </span>
                  <div>
                    <h3>Integrações</h3>
                    <p>Chaves e senhas ficam nas variáveis de ambiente do servidor (hPanel), nunca no banco.</p>
                  </div>
                </div>
              </div>
              <ul className="env-list">
                {integrations.map((i) => (
                  <li key={i.label}>
                    <span>
                      <b style={{ fontSize: 13 }}>{i.label}</b>
                      <br />
                      <code>{i.vars}</code>
                    </span>
                    <span className={`ui-badge ${i.ok ? "good" : "warn"}`}>
                      <i />
                      {i.ok ? "Configurado" : "Faltando"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>

      <div className="save-bar">
        <span className="status">
          {dirty ? (
            <span className="dirty-pill">
              <i /> Mudanças não salvas
            </span>
          ) : state.ok ? (
            <span className="ui-badge good">
              <i /> {state.ok}
            </span>
          ) : (
            "Nada muda no site até você salvar."
          )}
        </span>
        <button type="reset" className="ui-btn ghost" disabled={!dirty || pending}>
          Descartar
        </button>
        <button type="submit" className="ui-btn primary" disabled={pending}>
          {pending ? "Salvando…" : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}
