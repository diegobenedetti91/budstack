"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, requestResetAction, resetPasswordAction, type FormState } from "./actions";

function Alert({ state }: { state: FormState }) {
  if (state.error) return <div className="alert error" role="alert">{state.error}</div>;
  if (state.ok) return <div className="alert ok" role="status">{state.ok}</div>;
  return null;
}

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, {});
  return (
    <form action={action}>
      <Alert state={state} />
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="username" required autoFocus defaultValue={state.email} />
      </div>
      <div className="field">
        <label htmlFor="password">Senha</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <button className="btn btn-primary btn-block" disabled={pending} style={{ marginTop: 6 }}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
      <p className="muted" style={{ fontSize: 14, textAlign: "center", marginTop: 16 }}>
        <Link href="/esqueci-senha" style={{ color: "var(--blue)", fontWeight: 600 }}>
          Esqueci minha senha
        </Link>
      </p>
    </form>
  );
}

export function RequestResetForm() {
  const [state, action, pending] = useActionState(requestResetAction, {});
  return (
    <form action={action}>
      <Alert state={state} />
      <div className="field">
        <label htmlFor="email">E-mail da sua conta</label>
        <input id="email" name="email" type="email" autoComplete="email" required autoFocus defaultValue={state.email} />
      </div>
      <button className="btn btn-primary btn-block" disabled={pending}>
        {pending ? "Enviando…" : "Enviar link"}
      </button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, {});
  return (
    <form action={action}>
      <Alert state={state} />
      <input type="hidden" name="token" value={token} />
      <div className="field">
        <label htmlFor="password">Nova senha</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required autoFocus />
        <span className="hint">Pelo menos 8 caracteres.</span>
      </div>
      <div className="field">
        <label htmlFor="confirm">Repita a nova senha</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <button className="btn btn-primary btn-block" disabled={pending}>
        {pending ? "Salvando…" : "Salvar nova senha"}
      </button>
    </form>
  );
}
