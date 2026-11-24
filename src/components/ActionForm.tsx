"use client";

import { useActionState } from "react";

export interface ActionState {
  ok?: string;
  error?: string;
}

/** Formulário de uma ação do servidor com mensagem de resultado e confirmação opcional. */
export function ActionForm({
  action,
  children,
  confirm,
  className,
  style,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  confirm?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form
      action={formAction}
      className={className}
      style={style}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {state.error && (
        <div className="alert error" role="alert">
          {state.error}
        </div>
      )}
      {state.ok && (
        <div className="alert ok" role="status">
          {state.ok}
        </div>
      )}
      <fieldset disabled={pending} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }} aria-busy={pending}>
        {children}
      </fieldset>
    </form>
  );
}
