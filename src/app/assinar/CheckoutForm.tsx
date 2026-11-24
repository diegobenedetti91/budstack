"use client";

import { useActionState, useState } from "react";
import { checkoutAction, type CheckoutState } from "./actions";

interface Props {
  plano: string;
  ciclo: "mensal" | "anual";
  domainFee: string;
}

function Field({ id, label, error, hint, ...input }: { id: string; label: string; error?: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={`field${error ? " bad" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <input id={id} name={id} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} {...input} />
      {error ? (
        <span className="err" id={`${id}-err`}>
          {error}
        </span>
      ) : hint ? (
        <span className="hint">{hint}</span>
      ) : null}
    </div>
  );
}

export function CheckoutForm({ plano, ciclo, domainFee }: Props) {
  const [state, action, pending] = useActionState<CheckoutState, FormData>(checkoutAction, {});
  const f = state.fields ?? {};
  const val = state.values ?? {};
  const [domainOption, setDomainOption] = useState(val.domainOption || "OWN");

  return (
    <form action={action} noValidate>
      <input type="hidden" name="plano" value={plano} />
      <input type="hidden" name="ciclo" value={ciclo} />
      {state.error && (
        <div className="alert error" role="alert">
          {state.error}
        </div>
      )}

      <section className="card">
        <h2>
          <span className="n">1</span> Seus dados
        </h2>
        <Field id="name" label="Nome completo" autoComplete="name" required defaultValue={val.name} error={f.name} />
        <div className="grid2">
          <Field
            id="email"
            label="E-mail"
            type="email"
            autoComplete="email"
            required
            defaultValue={val.email}
            error={f.email}
            hint={ciclo === "mensal" ? "Use o mesmo e-mail da sua conta Mercado Pago." : undefined}
          />
          <Field id="phone" label="WhatsApp" type="tel" inputMode="tel" autoComplete="tel" placeholder="(19) 99999-9999" required defaultValue={val.phone} error={f.phone} />
        </div>
        <Field id="document" label="CPF ou CNPJ" inputMode="numeric" required defaultValue={val.document} error={f.document} />
      </section>

      <section className="card">
        <h2>
          <span className="n">2</span> Sua loja
        </h2>
        <Field id="storeName" label="Nome da loja" placeholder="Ex.: Ateliê da Carla" required defaultValue={val.storeName} error={f.storeName} />

        <div className="field" style={{ marginBottom: 6 }}>
          <label>Você já tem um domínio para a loja?</label>
        </div>
        <div className="options" role="radiogroup">
          <label className="option">
            <input type="radio" name="domainOption" value="OWN" checked={domainOption === "OWN"} onChange={() => setDomainOption("OWN")} />
            <span>
              <b>Sim, já tenho domínio</b>
              <span>Vamos usar o seu domínio. Você nos ajuda a apontá-lo para a loja.</span>
            </span>
          </label>
          <label className="option">
            <input type="radio" name="domainOption" value="REGISTER" checked={domainOption === "REGISTER"} onChange={() => setDomainOption("REGISTER")} />
            <span>
              <b>Não, quero que a BudStack registre</b>
              <span>Registramos o domínio em seu nome por {domainFee} o primeiro ano.</span>
            </span>
          </label>
        </div>
        <Field
          id="domain"
          label={domainOption === "OWN" ? "Seu domínio" : "Domínio que você quer"}
          placeholder="minhaloja.com.br"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={val.domain}
          error={f.domain}
          hint={domainOption === "REGISTER" ? "Se ele não estiver disponível, combinamos outra opção com você antes de registrar." : undefined}
        />
      </section>

      <section className="card">
        <label className="check-line">
          <input type="checkbox" name="terms" defaultChecked={val.terms === "on"} />
          <span>
            Li e aceito as condições: implantação em até 7 dias úteis após o envio dos materiais, garantia de 7 dias e cobrança {ciclo === "mensal" ? "mensal automática no cartão, que posso cancelar quando quiser" : "anual"}.
          </span>
        </label>
        {f.terms && (
          <p className="err" style={{ color: "var(--red)", fontSize: 12.5, fontWeight: 600, marginTop: 6 }}>
            {f.terms}
          </p>
        )}
        <button className="btn btn-primary btn-block" style={{ marginTop: 18 }} disabled={pending}>
          {pending ? "Abrindo o pagamento…" : "Ir para o pagamento"}
        </button>
        <p className="muted" style={{ fontSize: 13, textAlign: "center", marginTop: 10 }}>
          Você será levado ao Mercado Pago para pagar com segurança.
        </p>
      </section>
    </form>
  );
}
