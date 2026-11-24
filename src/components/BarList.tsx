// Barras horizontais de uma série (ranking/funil): rótulo, barra e valor em texto.
// O valor fica escrito ao lado, então a lista também serve de tabela.

export function BarList({ rows, format, note }: { rows: { label: string; value: number; extra?: string }[]; format: (v: number) => string; note?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="muted" style={{ fontSize: 14 }}>{note ?? "Sem dados no período."}</p>;
  return (
    <ul className="barlist">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="barlist-top">
            <span className="barlist-label">{r.label}</span>
            <span className="barlist-value">
              {format(r.value)}
              {r.extra ? <small> · {r.extra}</small> : null}
            </span>
          </div>
          <div className="barlist-track" aria-hidden="true">
            <span style={{ width: `${Math.max((r.value / max) * 100, r.value > 0 ? 1.5 : 0)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
