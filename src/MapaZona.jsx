import { temperatureColor } from './scene/stellarPhysics';
import { anoEnBorde, centroComparado, enZonaHabitable, listaDePlanetas, luzEnBorde, numeroZona, planetasDentro, zonaDeEstrella } from './scene/zonaHabitable';
import './mapaZona.css';

const ANCHO = 520, EJE = 38, ESTRELLA_X = 14, BORDE_DERECHO = 506, SEPARACION_LETRAS = 12;

// Mapa a escala de la zona: la estrella a la izquierda y cada planeta en su semieje.
function Mapa({ zona, planetas, temperatura }) {
  const tope = zona.optimistaExterior * 3;
  const conOrbita = planetas.filter(planeta => planeta.a > 0);
  const maximo = Math.min(tope, Math.max(zona.optimistaExterior * 1.25, ...conOrbita.map(planeta => planeta.a * 1.07)));
  const x = ua => ESTRELLA_X + ua / maximo * (BORDE_DERECHO - ESTRELLA_X);
  const color = `rgb(${temperatureColor(temperatura || 5772).map(valor => Math.round(valor * 255)).join(', ')})`;
  const [interior, exterior] = [x(zona.interior), x(zona.exterior)];
  // Los dos valores se separan si la franja es angosta.
  const juntos = exterior - interior < 74;
  // Puntos de izquierda a derecha; si dos letras se tocan, se omite la que choca.
  const puntos = [...conOrbita].sort((a, b) => a.a - b.a).reduce((lista, planeta) => {
    const cx = planeta.a > tope ? BORDE_DERECHO : x(planeta.a);
    const previa = lista.findLast(punto => punto.conLetra);
    return [...lista, { planeta, cx, conLetra: !previa || cx - previa.cx >= SEPARACION_LETRAS }];
  }, []);
  return <svg className="mapa-zona" viewBox={`0 0 ${ANCHO} 74`} role="img" aria-label={`Zona habitable entre ${numeroZona(zona.interior)} y ${numeroZona(zona.exterior)} UA`}>
    <circle cx={ESTRELLA_X} cy={EJE} r={10} fill={color} opacity=".25" />
    <circle cx={ESTRELLA_X} cy={EJE} r={4.5} fill={color} />
    <line x1={ESTRELLA_X} x2={BORDE_DERECHO + 8} y1={EJE} y2={EJE} stroke="rgba(255,255,255,.12)" />
    <rect x={x(zona.optimistaInterior)} y={EJE - 12} width={x(zona.optimistaExterior) - x(zona.optimistaInterior)} height={24} rx={3} fill="rgba(29,107,94,.35)" />
    <rect x={interior} y={EJE - 12} width={exterior - interior} height={24} rx={3} fill="rgba(154,242,212,.28)" stroke="rgba(154,242,212,.55)" />
    <text x={interior} y={18} textAnchor={juntos ? 'end' : 'middle'} className="mapa-zona-valor">{numeroZona(zona.interior)}</text>
    <text x={exterior} y={18} textAnchor={juntos ? 'start' : 'middle'} className="mapa-zona-valor">{numeroZona(zona.exterior)} UA</text>
    {puntos.map(({ planeta, cx, conLetra }) => {
      const dentro = enZonaHabitable(zona, planeta.a);
      return <g key={planeta.n}>
        {planeta.a > tope ? <text x={cx} y={EJE + 4} textAnchor="middle" className="mapa-zona-fuera">&gt;</text>
          : <circle cx={cx} cy={EJE} r={dentro ? 3.4 : 2.6} className={dentro ? 'mapa-zona-planeta dentro' : 'mapa-zona-planeta'} />}
        {conLetra && <text x={cx} y={68} textAnchor="middle" className={dentro ? 'mapa-zona-letra dentro' : 'mapa-zona-letra'}>{planeta.n.split(' ').pop()}</text>}
      </g>;
    })}
  </svg>;
}

// Zona habitable en la ficha: se pulsa para mirarla de frente. El realce queda para los sistemas con un planeta dentro.
// Cada dato habla de la zona y nombra a la estrella (`nombre`).
export default function MapaZonaHabitable({ star, nombre, fichas, planetas, temperatura, masa, comparar = false, onMostrar }) {
  const zona = zonaDeEstrella(star, fichas);
  if (!zona) return null;
  const dentroDeZona = planetas.filter(planeta => enZonaHabitable(zona, planeta.a));
  const dentro = dentroDeZona.length;
  const [anoInterior, anoExterior] = [anoEnBorde(zona.interior, masa), anoEnBorde(zona.exterior, masa)];
  const unidad = anoInterior?.unidad === anoExterior?.unidad;
  return <button className={`zona-ficha${dentro ? ' con-planeta' : ''}`} onClick={onMostrar}>
    <span className="zona-ficha-titulo"><span>Zona habitable</span>{dentro > 0 && <em>{planetasDentro(dentro)}</em>}</span>
    <Mapa zona={zona} planetas={planetas} temperatura={temperatura} />
    <span className="zona-ficha-datos">
      <span><span>Dónde está</span><b>Entre {numeroZona(zona.interior)} y {numeroZona(zona.exterior)} UA de {nombre}</b></span>
      <span><span>Planetas en la zona</span><b>{listaDePlanetas(dentroDeZona.map(planeta => planeta.n), nombre)}</b></span>
      {comparar && <span><span>Comparación</span><b>{centroComparado((zona.interior + zona.exterior) / 2, nombre)}</b></span>}
      <span><span>Luz</span><b>Un planeta en la zona recibe entre {luzEnBorde(zona.exterior, zona)} % y {luzEnBorde(zona.interior, zona)} % de la luz que recibe la Tierra</b></span>
      {anoInterior && <span><span>Año</span><b>Un planeta en la zona tarda entre {unidad ? `${anoInterior.valor} y ${anoExterior.valor} ${anoExterior.unidad}` : `${anoInterior.valor} ${anoInterior.unidad} y ${anoExterior.valor} ${anoExterior.unidad}`} en dar una vuelta a {nombre}</b></span>}
      <small>1 UA es la distancia de la Tierra al Sol</small>
    </span>
  </button>;
}
