"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "./ActionForm";

/**
 * Ação com janela de confirmação (no lugar do confirm() do navegador).
 * O botão abre a janela; campos extras (motivo, reembolso…) ficam dentro dela e vão junto no envio.
 */
export function ConfirmForm({
  action,
  hidden,
  trigger,
  triggerClass = "ui-btn secondary sm",
  title,
  description,
  confirmText,
  tone = "primary",
  children,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  hidden: Record<string, string>;
  trigger: React.ReactNode;
  triggerClass?: string;
  title: string;
  description: React.ReactNode;
  confirmText: string;
  tone?: "primary" | "danger";
  children?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const dialog = useRef<HTMLDialogElement>(null);

  // Fecha a janela quando a ação termina (sucesso ou erro aparece abaixo do botão)
  useEffect(() => {
    if (state.ok || state.error) dialog.current?.close();
  }, [state]);

  return (
    <form action={formAction} className="confirm-form">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="button" className={triggerClass} onClick={() => dialog.current?.showModal()} disabled={pending}>
        {trigger}
      </button>
      {state.error && <p className="ui-msg bad">{state.error}</p>}
      {state.ok && <p className="ui-msg good">{state.ok}</p>}
      <dialog ref={dialog} className="ui-dialog" onClick={(e) => e.target === dialog.current && dialog.current?.close()}>
        <div className="ui-dialog-body">
          <h3>{title}</h3>
          <div className="ui-dialog-text">{description}</div>
          {children && <div className="ui-dialog-fields">{children}</div>}
          <div className="ui-dialog-actions">
            <button type="button" className="ui-btn secondary" onClick={() => dialog.current?.close()}>
              Voltar
            </button>
            <button type="submit" className={`ui-btn ${tone === "danger" ? "danger" : "primary"}`} disabled={pending}>
              {pending ? "Aguarde…" : confirmText}
            </button>
          </div>
        </div>
      </dialog>
    </form>
  );
}
