import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { formatDocument, formatPhone } from "@/lib/format";
import { ActionForm } from "@/components/ActionForm";
import { changePasswordAction, saveProfileAction } from "../actions";

export const metadata: Metadata = { title: "Meus dados" };

export default async function DadosPage() {
  const user = await requireUser();
  return (
    <>
      <h1>Meus dados</h1>
      <p className="page-sub">Seus dados de contato e a senha de acesso.</p>

      <div className="detail" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <section className="card">
          <h2>Contato</h2>
          <ActionForm action={saveProfileAction}>
            <div className="field">
              <label htmlFor="name">Nome completo</label>
              <input id="name" name="name" defaultValue={user.name} autoComplete="name" required />
            </div>
            <div className="field">
              <label htmlFor="phone">WhatsApp</label>
              <input id="phone" name="phone" type="tel" defaultValue={user.phone ? formatPhone(user.phone) : ""} autoComplete="tel" required />
            </div>
            <div className="field">
              <label htmlFor="email">E-mail (login)</label>
              <input id="email" value={user.email} readOnly disabled />
              <span className="hint">Para trocar o e-mail, fale com a BudStack.</span>
            </div>
            {user.document && (
              <div className="field">
                <label>CPF/CNPJ</label>
                <input value={formatDocument(user.document)} readOnly disabled />
              </div>
            )}
            <button className="btn btn-primary btn-sm">Salvar</button>
          </ActionForm>
        </section>

        <section className="card">
          <h2>Senha</h2>
          <ActionForm action={changePasswordAction}>
            <div className="field">
              <label htmlFor="current">Senha atual</label>
              <input id="current" name="current" type="password" autoComplete="current-password" required />
            </div>
            <div className="field">
              <label htmlFor="password">Nova senha</label>
              <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
              <span className="hint">Pelo menos 8 caracteres.</span>
            </div>
            <div className="field">
              <label htmlFor="confirm">Repita a nova senha</label>
              <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
            </div>
            <button className="btn btn-primary btn-sm">Trocar senha</button>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
