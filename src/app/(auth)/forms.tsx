"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, requestResetAction, resetPasswordAction, type FormState } from "./actions";
import { PasswordInput } from "@/components/PasswordInput";

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
        <label htmlFor="password" className="label-row">
          Senha
          <Link href="/esqueci-senha">Esqueci minha senha</Link>
        </label>
        <PasswordInput id="password" name="password" autoComplete="current-password" required />
      </div>
      <button className="btn btn-primary btn-block" disabled={pending} style={{ marginTop: 6 }}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
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
        <PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} required autoFocus />
        <span className="hint">Pelo menos 8 caracteres.</span>
      </div>
      <div className="field">
        <label htmlFor="confirm">Repita a nova senha</label>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" minLength={8} required />
      </div>
      <button className="btn btn-primary btn-block" disabled={pending}>
        {pending ? "Salvando…" : "Salvar nova senha"}
      </button>
    </form>
  );
}
