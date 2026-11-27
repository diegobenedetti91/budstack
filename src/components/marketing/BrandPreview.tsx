"use client";

import { useState } from "react";

const COLORS = [
  ["#2F5BFF", "Azul"],
  ["#111827", "Preto"],
  ["#D9467A", "Rosa"],
  ["#0E9F6E", "Verde"],
  ["#B7791F", "Caramelo"],
] as const;

/** Escolha uma cor e veja botões e e-mail da loja mudarem (demonstração). */
export function BrandPreview() {
  const [color, setColor] = useState<string>(COLORS[0][0]);
  return (
    <div className="mk-panel">
      <div className="mk-panel-title">
        Experimente: a cor da sua marca <span>Prévia</span>
      </div>
      <div className="mk-swatches" role="group" aria-label="Cor da marca">
        {COLORS.map(([c, name]) => (
          <button key={c} type="button" style={{ background: c }} aria-label={name} aria-pressed={color === c} onClick={() => setColor(c)} />
        ))}
      </div>
      <div className="mk-preview-btn" style={{ background: color }}>
        Comprar agora
      </div>
      <div className="mk-preview-out" style={{ color, borderColor: color }}>
        Adicionar aos favoritos
      </div>
      <div className="mk-row" style={{ marginTop: 12 }}>
        <span>
          <b style={{ color }}>Seu pedido foi enviado!</b>
          <small>Olá, Carla. Seu pedido #1042 já está a caminho.</small>
        </span>
      </div>
    </div>
  );
}
