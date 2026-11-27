import { Icon } from "../Icon";

/** Celular com uma loja de exemplo e notificações chegando (decorativo). Cabe inteiro em qualquer tela. */
export function PhoneMock() {
  return (
    <div className="mk-phone" aria-hidden="true">
      <div className="mk-phone-screen">
        <span className="mk-notch" />
        <div className="mk-toasts">
          <div className="mk-toast">
            <span className="ic" style={{ background: "#10B981" }}>
              <Icon name="pix" />
            </span>
            <span>
              <b>Pedido pago no Pix · R$ 289,90</b>
              <span>Camisa Linho + Vestido Midi</span>
            </span>
          </div>
          <div className="mk-toast">
            <span className="ic" style={{ background: "#2F5BFF" }}>
              <Icon name="file" />
            </span>
            <span>
              <b>Nota fiscal autorizada</b>
              <span>Enviada ao cliente por e-mail</span>
            </span>
          </div>
          <div className="mk-toast">
            <span className="ic" style={{ background: "#8B5CF6" }}>
              <Icon name="truck" />
            </span>
            <span>
              <b>Etiqueta pronta para imprimir</b>
              <span>Rastreio enviado ao cliente</span>
            </span>
          </div>
        </div>
        <div className="mk-shop-bar">
          <span>SUA MARCA</span>
          <span>Nova coleção</span>
        </div>
        <div className="mk-shop-hero">
          <small>COLEÇÃO VERÃO</small>
          <b>Leveza para todos os dias</b>
          <i>Comprar agora</i>
        </div>
        <div className="mk-shop-grid">
          {[
            ["mk-p1", "Camisa Linho", "R$ 159,90", "-20%"],
            ["mk-p2", "Vestido Midi", "R$ 229,90", ""],
            ["mk-p3", "Blusa Tricô", "R$ 139,90", ""],
            ["mk-p4", "Saia Plissada", "R$ 179,90", ""],
          ].map(([c, n, p, tag]) => (
            <div key={n} className="mk-prod">
              <div className={`ph ${c}`}>{tag && <em>{tag}</em>}</div>
              <p>{n}</p>
              <b>{p}</b>
            </div>
          ))}
        </div>
        <div className="mk-buy">Pix com 5% OFF · 6x no cartão</div>
      </div>
    </div>
  );
}
