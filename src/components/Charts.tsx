"use client";

import { useState } from "react";
import { fmt, monthLabel, monthTick } from "@/lib/chart-format";

// Gráficos do BI em HTML (sem biblioteca). Cores por função: série 1 azul, série 2 laranja
// (validadas no fundo branco). Texto sempre nas cores de texto, nunca na cor da série.

const SERIES = ["#2a78d6", "#eb6834"];

/** Colunas por mês, com dica ao passar o mouse (ou focar com o teclado) e legenda para 2+ séries. */
export function ColumnChart({
  data,
  series,
  kind,
  label,
}: {
  data: { key: string; values: number[] }[];
  series: string[];
  kind: "money" | "int";
  label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.flatMap((d) => d.values));
  return (
    <figure className="viz" aria-label={label}>
      {series.length > 1 && (
        <figcaption className="viz-legend">
          {series.map((s, i) => (
            <span key={s}>
              <i style={{ background: SERIES[i] }} /> {s}
            </span>
          ))}
        </figcaption>
      )}
      <div className="viz-plot">
        <span className="viz-max">{fmt(max, kind)}</span>
        <div className="viz-cols" onMouseLeave={() => setHover(null)}>
          {data.map((d, i) => (
            <div
              key={d.key}
              className={`viz-col${hover === i ? " on" : ""}`}
              tabIndex={0}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`${monthLabel(d.key)}: ${d.values.map((v, j) => `${series[j]} ${fmt(v, kind)}`).join(", ")}`}
            >
              <div className="viz-bars">
                {d.values.map((v, j) => (
                  <span key={j} style={{ height: `${(v / max) * 100}%`, background: SERIES[j] }} />
                ))}
              </div>
              <span className="viz-x">{monthTick(d.key, i)}</span>
              {hover === i && (
                <div className={`viz-tip${i > data.length - 4 ? " left" : i < 3 ? " right" : ""}`} role="tooltip">
                  <b>{monthLabel(d.key)}</b>
                  {d.values.map((v, j) => (
                    <span key={j}>
                      <i style={{ background: SERIES[j] }} />
                      {series[j]}: <b>{fmt(v, kind)}</b>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <details className="viz-table">
        <summary>Ver tabela</summary>
        <table className="mini-table">
          <thead>
            <tr>
              <th>Mês</th>
              {series.map((s) => (
                <th key={s}>{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.key}>
                <td>{monthLabel(d.key)}</td>
                {d.values.map((v, j) => (
                  <td key={j}>{fmt(v, kind)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
