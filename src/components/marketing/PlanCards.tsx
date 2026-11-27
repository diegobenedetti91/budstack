import Link from "next/link";
import type { PlanView, Cycle } from "@/lib/plans";
import type { Settings } from "@/lib/settings-schema";
import { money } from "@/lib/format";
import { Icon } from "../Icon";

function annualCents(p: PlanView, s: Settings) {
  return p.monthlyCents * s.annual_months_charged;
}

/** Cartões de planos (fundo escuro). `limit` mostra só os primeiros recursos de cada plano. */
export function PlanCards({ plans, cycle, s, limit }: { plans: PlanView[]; cycle: Cycle; s: Settings; limit?: number }) {
  const ciclo = cycle === "ANUAL" ? "anual" : "mensal";
  return (
    <div className="mk-plans" style={plans.length < 3 ? { gridTemplateColumns: `repeat(${plans.length}, minmax(0, 400px))`, justifyContent: "center" } : undefined}>
      {plans.map((p) => {
        const price = cycle === "ANUAL" ? annualCents(p, s) : p.monthlyCents;
        const features = limit ? p.features.slice(0, limit) : p.features;
        return (
          <article key={p.id} id={p.id} className={`mk-plan mk-reveal${p.highlight ? " hl" : ""}`}>
            {p.highlight && <span className="tag">Mais escolhido</span>}
            <h3>{p.name}</h3>
            <p className="tl">{p.tagline}</p>
            <div className="price">
              <b>{money(cycle === "ANUAL" ? Math.round(price / 12) : price)}</b>
              <span>/mês</span>
            </div>
            <p className="sub">{cycle === "ANUAL" ? `${money(price)} por ano · Pix ou até ${s.annual_max_installments}x` : "Cobrado todo mês no cartão"}</p>
            <ul>
              {features.map((f) => (
                <li key={f.id}>
                  <Icon name="check" className="ico" />
                  {f.name}
                </li>
              ))}
              {limit && p.features.length > limit && <li style={{ color: "rgba(214,223,255,.6)" }}>+ {p.features.length - limit} recursos</li>}
            </ul>
            <Link href={`/assinar?plano=${p.id}&ciclo=${ciclo}`} className={`mk-btn ${p.highlight ? "glow" : "ghost-dark"}`}>
              Assinar o {p.name}
            </Link>
          </article>
        );
      })}
    </div>
  );
}
