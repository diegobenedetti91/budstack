const ITEMS = ["Mercado Pago", "Pix", "NuPay", "InfinitePay", "Melhor Envio", "Correios", "Bling", "Meta Ads", "Google", "WhatsApp", "IA Claude"];

/** Faixa de integrações em movimento contínuo (a lista é repetida para o laço não ter emenda). */
export function Marquee() {
  return (
    <div className="mk-marquee">
      <p className="mk-marquee-label">Integrado com quem você já usa</p>
      <div className="mk-marquee-track" aria-label={ITEMS.join(", ")}>
        {[...ITEMS, ...ITEMS].map((t, i) => (
          <span key={i} aria-hidden={i >= ITEMS.length}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
