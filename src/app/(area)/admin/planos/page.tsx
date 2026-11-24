import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { money } from "@/lib/format";
import { ActionForm } from "@/components/ActionForm";
import { deletePlanAction, saveFeaturesAction, savePlanAction } from "../actions";

export const metadata: Metadata = { title: "Planos e recursos" };

const toInput = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

export default async function PlanosAdminPage() {
  const [plans, features, links, counts, s] = await Promise.all([
    prisma.plan.findMany({ orderBy: [{ sort: "asc" }, { monthlyCents: "asc" }] }),
    prisma.feature.findMany({ orderBy: { sort: "asc" } }),
    prisma.planFeature.findMany(),
    prisma.subscription.groupBy({ by: ["plan"], where: { status: { in: ["ACTIVE", "PAST_DUE"] } }, _count: true }),
    getSettings(),
  ]);
  const has = new Set(links.map((l) => `${l.planId}:${l.featureId}`));
  const active = new Map(counts.map((c) => [c.plan, c._count]));

  return (
    <>
      <h1>Planos e recursos</h1>
      <p className="page-sub">Preços, descrições e o que cada plano oferece. Tudo aparece no site assim que você salva. Quem já assinou mantém o preço da compra.</p>

      <h2 className="section-title">Planos</h2>
      <div className="grid-cards">
        {plans.map((p) => (
          <section key={p.id} className="card" style={{ margin: 0 }}>
            <ActionForm action={savePlanAction}>
              <input type="hidden" name="id" value={p.id} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span className="badge gray">/{p.id}</span>
                <span className="muted" style={{ fontSize: 13 }}>
                  {active.get(p.id) ?? 0} ativa(s)
                </span>
              </div>
              <div className="field">
                <label>Nome</label>
                <input name="name" defaultValue={p.name} required />
              </div>
              <div className="field">
                <label>Descrição curta</label>
                <input name="tagline" defaultValue={p.tagline} />
              </div>
              <div className="grid2">
                <div className="field">
                  <label>Preço mensal (R$)</label>
                  <input name="price" defaultValue={toInput(p.monthlyCents)} inputMode="decimal" required />
                  <span className="hint">Anual: {money(p.monthlyCents * s.annual_months_charged)}</span>
                </div>
                <div className="field">
                  <label>Ordem</label>
                  <input name="sort" type="number" defaultValue={p.sort} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap", margin: "4px 0 14px" }}>
                <label className="switch">
                  <input type="checkbox" name="active" defaultChecked={p.active} /> Ativo no site
                </label>
                <label className="switch">
                  <input type="checkbox" name="highlight" defaultChecked={p.highlight} /> Mais escolhido
                </label>
              </div>
              <button className="btn btn-primary btn-sm">Salvar plano</button>
            </ActionForm>
            {!active.get(p.id) && (
              <ActionForm action={deletePlanAction} confirm={`Apagar o plano ${p.name}?`} style={{ marginTop: 8 }}>
                <input type="hidden" name="id" value={p.id} />
                <button className="btn btn-danger btn-sm">Apagar</button>
              </ActionForm>
            )}
          </section>
        ))}

        <section className="card" style={{ margin: 0, borderStyle: "dashed" }}>
          <ActionForm action={savePlanAction}>
            <h2 style={{ fontSize: 16 }}>Novo plano</h2>
            <div className="field">
              <label>Nome</label>
              <input name="name" required placeholder="Ex.: Premium" />
            </div>
            <div className="field">
              <label>Descrição curta</label>
              <input name="tagline" />
            </div>
            <div className="grid2">
              <div className="field">
                <label>Preço mensal (R$)</label>
                <input name="price" inputMode="decimal" required placeholder="499,00" />
              </div>
              <div className="field">
                <label>Ordem</label>
                <input name="sort" type="number" defaultValue={plans.length + 1} />
              </div>
            </div>
            <label className="switch" style={{ margin: "4px 0 14px" }}>
              <input type="checkbox" name="active" /> Já mostrar no site
            </label>
            <button className="btn btn-ghost btn-sm">Criar plano</button>
          </ActionForm>
        </section>
      </div>

      <h2 className="section-title">O que cada plano oferece</h2>
      <p className="muted" style={{ marginTop: -6, marginBottom: 12, fontSize: 14 }}>
        Marque os recursos de cada plano. Eles aparecem nos cards e no comparativo da página de planos, na ordem indicada.
      </p>
      <ActionForm action={saveFeaturesAction}>
        <div className="table-wrap">
          <table className="matrix">
            <thead>
              <tr>
                <th style={{ width: "45%" }}>Recurso</th>
                <th>Ordem</th>
                {plans.map((p) => (
                  <th key={p.id}>{p.name}</th>
                ))}
                <th>Visível</th>
                <th>Apagar</th>
              </tr>
            </thead>
            <tbody>
              {features.map((f) => (
                <tr key={f.id}>
                  <td>
                    <input type="text" name={`name_${f.id}`} defaultValue={f.name} aria-label="Nome do recurso" />
                  </td>
                  <td style={{ width: 80 }}>
                    <input type="text" inputMode="numeric" name={`sort_${f.id}`} defaultValue={f.sort} aria-label="Ordem" style={{ textAlign: "center" }} />
                  </td>
                  {plans.map((p) => (
                    <td key={p.id}>
                      <input type="checkbox" name={`pf_${p.id}_${f.id}`} defaultChecked={has.has(`${p.id}:${f.id}`)} aria-label={`${f.name} no plano ${p.name}`} />
                    </td>
                  ))}
                  <td>
                    <input type="checkbox" name={`active_${f.id}`} defaultChecked={f.active} aria-label="Visível" />
                  </td>
                  <td>
                    <input type="checkbox" name={`del_${f.id}`} aria-label="Apagar recurso" />
                  </td>
                </tr>
              ))}
              <tr>
                <td>
                  <input type="text" name="new_name" placeholder="+ Novo recurso (ex.: Domínio grátis no 1º ano)" aria-label="Novo recurso" />
                </td>
                <td />
                {plans.map((p) => (
                  <td key={p.id}>
                    <input type="checkbox" name={`pfnew_${p.id}`} aria-label={`Novo recurso no plano ${p.name}`} />
                  </td>
                ))}
                <td />
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        <button className="btn btn-primary btn-sm" style={{ marginTop: 14 }}>
          Salvar recursos
        </button>
      </ActionForm>
    </>
  );
}
