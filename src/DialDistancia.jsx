// © 2026 Sergio Bastidas Acosta. Distancia al objetivo actual junto al control de vuelo.
export default function DialDistancia({ titulo = 'Distancia al Sol' }) {
  return <section className="dial-distancia" aria-label={titulo}>
    <div className="dial-superficie">
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <defs><linearGradient id="degradado-distancia"><stop stopColor="#345065"/><stop offset="1" stopColor="#739eaa"/></linearGradient></defs>
        <g transform="rotate(135 100 100)">
          <circle className="dial-fondo" cx="100" cy="100" r="86" pathLength="100" strokeDasharray="75 100"/>
          <circle className="dial-arco-distancia" data-distance-arc cx="100" cy="100" r="86" pathLength="100" strokeDasharray="0 100"/>
        </g>
        {Array.from({length:31},(_,i)=>{const a=(135+i*9)*Math.PI/180;return <line key={i} x1={100+Math.cos(a)*74} y1={100+Math.sin(a)*74} x2={100+Math.cos(a)*(i%5===0?67:70)} y2={100+Math.sin(a)*(i%5===0?67:70)}/>;})}
      </svg>
      <div className="dial-lectura"><span className="dial-titulo">{titulo.toUpperCase()}</span><strong data-distance>—</strong><span data-distance-unit>UA</span><small data-distance-detail /></div>
      <i className="pildora-barra" aria-hidden="true"><b data-distance-bar /></i>
    </div>
  </section>;
}
