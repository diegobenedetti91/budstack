import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { formatDocument, formatPhone } from "@/lib/format";
import { ActionForm } from "@/components/ActionForm";
import { PasswordInput } from "@/components/PasswordInput";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { changePasswordAction, saveProfileAction } from "../actions";

export const metadata: Metadata = { title: "Meus dados" };

export default async function DadosPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="Meus dados" subtitle="Seus dados de contato e a senha de acesso." />

      <div className="ui-grid-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Card>
          <CardHeader title="Contato" subtitle="Usado nos avisos da assinatura e da sua loja" icon="user" />
          <div className="ui-card-body">
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
                  <label htmlFor="doc">CPF/CNPJ</label>
                  <input id="doc" value={formatDocument(user.document)} readOnly disabled />
                </div>
              )}
              <button className="ui-btn primary">Salvar</button>
            </ActionForm>
          </div>
        </Card>

        <Card>
          <CardHeader title="Senha" subtitle="Ao trocar, os outros aparelhos são desconectados" icon="lock" />
          <div className="ui-card-body">
            <ActionForm action={changePasswordAction}>
              <div className="field">
                <label htmlFor="current">Senha atual</label>
                <PasswordInput id="current" name="current" autoComplete="current-password" required />
              </div>
              <div className="field">
                <label htmlFor="password">Nova senha</label>
                <PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} required />
                <span className="hint">Pelo menos 8 caracteres.</span>
              </div>
              <div className="field">
                <label htmlFor="confirm">Repita a nova senha</label>
                <PasswordInput id="confirm" name="confirm" autoComplete="new-password" minLength={8} required />
              </div>
              <button className="ui-btn primary">Trocar senha</button>
            </ActionForm>
          </div>
        </Card>
      </div>
    </>
  );
}
