"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, {});
  return (
    <form action={action}>
      {state.error && (
        <div className="alert error" role="alert">
          {state.error}
        </div>
      )}
      <div className="field">
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="username" required autoFocus />
      </div>
      <div className="field">
        <label htmlFor="password">Senha</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <button className="btn btn-primary btn-block" disabled={pending} style={{ marginTop: 6 }}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
