import { Icon } from "./Icon";

/** Ilustração da loja (HTML/CSS) com avisos de venda, nota e etiqueta. Decorativa. */
export function HeroVisual() {
  return (
    <div className="stage" aria-hidden="true">
      <div className="browser">
        <div className="browser-bar">
          <i />
          <i />
          <i />
          <span className="url">suamarca.com.br</span>
        </div>
        <div className="promo-strip">5% OFF NO PIX · ENVIAMOS PARA TODO O BRASIL</div>
        <div className="shop-top">
          <span>SUA MARCA</span>
          <span className="pill">Nova coleção</span>
        </div>
        <div className="shop-hero">
          <small>COLEÇÃO VERÃO</small>
          <b>Leveza para todos os dias</b>
          <span className="mini-btn">Comprar agora</span>
        </div>
        <div className="products">
          {[
            ["ph-1", "Camisa Linho", "R$ 159,90", "-20%"],
            ["ph-2", "Vestido Midi", "R$ 229,90", ""],
            ["ph-3", "Blusa Tricô", "R$ 139,90", ""],
          ].map(([ph, name, price, tag]) => (
            <div key={name} className="p-card">
              <div className={`ph ${ph}`}>
                {tag && <span className="tag">{tag}</span>}
                <span className="garment" />
              </div>
              <div className="nm">{name}</div>
              <div className="pr">{price}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="float f-1">
        <span className="ic ic-green">
          <Icon name="pix" />
        </span>
        <div>
          <b>Pedido pago no Pix</b>
          <span>#1042 · R$ 289,90</span>
        </div>
      </div>
      <div className="float f-2">
        <span className="ic ic-blue">
          <Icon name="file" />
        </span>
        <div>
          <b>NF-e autorizada</b>
          <span>Enviada ao cliente</span>
        </div>
      </div>
      <div className="float f-3">
        <span className="ic ic-violet">
          <Icon name="truck" />
        </span>
        <div>
          <b>Etiqueta pronta</b>
          <span>Rastreio gerado</span>
        </div>
      </div>
    </div>
  );
}
