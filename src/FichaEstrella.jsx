import { useEffect, useId, useState } from 'react';
import { temperatureColor } from './scene/stellarPhysics';
import { LIGHT_YEAR_PC } from './scene/scale';
import { indiceBusqueda } from './indiceBusqueda';
import { Dato } from './FichaLateral';

const CONSTELACIONES = { And: 'Andrómeda', Ant: 'Antlia', Aps: 'Ave del Paraíso', Aqr: 'Acuario', Aql: 'Águila', Ara: 'Altar', Ari: 'Aries', Aur: 'Auriga', Boo: 'Boyero', Cae: 'Cincel', Cam: 'Jirafa', Cnc: 'Cáncer', CVn: 'Lebreles', CMa: 'Can Mayor', CMi: 'Can Menor', Cap: 'Capricornio', Car: 'Quilla', Cas: 'Casiopea', Cen: 'Centauro', Cep: 'Cefeo', Cet: 'Ballena', Cha: 'Camaleón', Cir: 'Compás', Col: 'Paloma', Com: 'Cabellera de Berenice', CrA: 'Corona Austral', CrB: 'Corona Boreal', Crv: 'Cuervo', Crt: 'Copa', Cru: 'Cruz del Sur', Cyg: 'Cisne', Del: 'Delfín', Dor: 'Dorado', Dra: 'Dragón', Equ: 'Caballito', Eri: 'Erídano', For: 'Horno', Gem: 'Géminis', Gru: 'Grulla', Her: 'Hércules', Hor: 'Reloj', Hya: 'Hidra', Hyi: 'Hidra Macho', Ind: 'Indio', Lac: 'Lagarto', Leo: 'Leo', LMi: 'León Menor', Lep: 'Liebre', Lib: 'Libra', Lup: 'Lobo', Lyn: 'Lince', Lyr: 'Lira', Men: 'Mesa', Mic: 'Microscopio', Mon: 'Unicornio', Mus: 'Mosca', Nor: 'Escuadra', Oct: 'Octante', Oph: 'Ofiuco', Ori: 'Orión', Pav: 'Pavo', Peg: 'Pegaso', Per: 'Perseo', Phe: 'Fénix', Pic: 'Pintor', Psc: 'Piscis', PsA: 'Pez Austral', Pup: 'Popa', Pyx: 'Brújula', Ret: 'Retículo', Sge: 'Flecha', Sgr: 'Sagitario', Sco: 'Escorpio', Scl: 'Escultor', Sct: 'Escudo', Ser: 'Serpiente', Sex: 'Sextante', Tau: 'Tauro', Tel: 'Telescopio', Tri: 'Triángulo', TrA: 'Triángulo Austral', Tuc: 'Tucán', UMa: 'Osa Mayor', UMi: 'Osa Menor', Vel: 'Vela', Vir: 'Virgo', Vol: 'Pez Volador', Vul: 'Zorra' };

const TIPOS = {
  O: ['Estrella azul', 'Una de las más raras y furiosas de la galaxia: arde tan deprisa que vivirá apenas millones de años, un suspiro en la historia del cosmos.'],
  B: ['Estrella azul', 'Caliente y luminosa, gasta su combustible a un ritmo que el Sol tardaría miles de veces más en igualar. Su brillo se ve a través de medio brazo galáctico.'],
  A: ['Estrella blanca', 'Más caliente y joven que el Sol, gira con rapidez y brilla con una luz blanca y limpia, como Sirio o Vega en el cielo nocturno.'],
  F: ['Estrella blanca amarillenta', 'Un poco mayor y más caliente que el Sol. Si tuviera un planeta como la Tierra, su cielo sería algo más blanco y más intenso que el nuestro.'],
  G: ['Estrella amarilla', 'Es de la misma familia que el Sol. Su lenta y estable combustión, durante miles de millones de años, es justo la clase de paciencia que permitió la vida en la Tierra.'],
  K: ['Enana naranja', 'Más fría y modesta que el Sol, pero también más longeva: seguirá encendida mucho después de que nuestra estrella se apague.'],
  M: ['Enana roja', 'La clase más común de la galaxia y la más paciente: quema su hidrógeno tan despacio que vivirá billones de años, mucho más que la edad actual del universo.'],
  D: ['Enana blanca', 'El rescoldo de una estrella que ya murió: tanta masa como un sol comprimida en el tamaño de un planeta, enfriándose poco a poco durante eones.'],
};
const numero = (valor, digitos = 3) => valor.toLocaleString('es-CL', { maximumSignificantDigits: digitos });

function tipoEstelar(espectro) {
  const letra = espectro?.trim()[0]?.toUpperCase();
  const tipo = TIPOS[letra];
  if (!tipo) return null;
  const gigante = /(I{1,3}|II|IV)(?![a-z]*V)/.test(espectro.slice(1)) && !/\bV\b/.test(espectro);
  return { nombre: gigante && letra !== 'D' ? tipo[0].replace(/^(Estrella|Enana)/, 'Gigante') : tipo[0], texto: tipo[1] };
}

// Magnitud aparente desde su magnitud absoluta y distancia, comparada con estrellas conocidas.
const REFERENCIAS = [['Sirio', -1.46], ['Vega', 0.03], ['Polaris', 1.98], ['Megrez', 3.3], ['Alcor', 3.99]];
function brilloDesdeLaTierra(star, nombre) {
  if (!Number.isFinite(star.m) || !(star.d > 0)) return null;
  const magnitud = star.m + 5 * Math.log10(star.d / 10);
  if (magnitud >= 8) return 'Solo con telescopio';
  if (magnitud >= 6) return 'Solo con binoculares';
  if (magnitud < -1) return 'A simple vista, de las más brillantes del cielo';
  const [cercana] = REFERENCIAS.filter(([estrella]) => estrella !== nombre)
    .sort((a, b) => Math.abs(a[1] - magnitud) - Math.abs(b[1] - magnitud))[0];
  return `A simple vista, brilla como ${cercana}`;
}

// Color de su temperatura para el título, aclarado lo justo para leerse sobre fondo oscuro.
function colorLegible(temperatura) {
  const rgb = temperatureColor(temperatura);
  const luminancia = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  const mezcla = Math.max(0, (0.72 - luminancia) / (1 - luminancia));
  return `rgb(${rgb.map(v => Math.round((v + (1 - v) * mezcla) * 255)).join(', ')})`;
}

const temperaturaDesdeColor = indice => Number.isFinite(indice) && indice > -0.4 && indice < 2
  ? 4600 * (1 / (0.92 * indice + 1.7) + 1 / (0.92 * indice + 0.62)) : null;

// Resumen de Wikipedia: en español y, si no hay, en inglés. Un nombre puede ser también de un
// personaje o un lugar, así que se exige que el texto hable de una estrella.
const ES_ESTRELLA = /estrella|star\b|enana|dwarf|gigante|giant|binari|binary|constelaci|constellation|sistema estelar/i;
async function resumenWikipedia(nombre, signal) {
  const intentos = [['es', nombre], ['es', `${nombre} (estrella)`], ['en', nombre], ['en', `${nombre} (star)`]];
  for (const [lengua, titulo] of intentos) {
    try {
      const respuesta = await fetch(`https://${lengua}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titulo.replace(/ /g, '_'))}`, { signal });
      if (!respuesta.ok) continue;
      const pagina = await respuesta.json();
      if (pagina.type === 'standard' && pagina.extract && ES_ESTRELLA.test(`${pagina.description || ''} ${pagina.extract}`)) {
        return { texto: pagina.extract, enlace: pagina.content_urls?.desktop?.page, lengua };
      }
    } catch (error) {
      if (error.name === 'AbortError') throw error;
    }
  }
  return null;
}

function useResumen(nombre) {
  const [resumen, setResumen] = useState({ nombre: null, datos: null });
  useEffect(() => {
    const control = new AbortController();
    resumenWikipedia(nombre, control.signal).then(datos => setResumen({ nombre, datos })).catch(() => {});
    return () => control.abort();
  }, [nombre]);
  return resumen.nombre === nombre ? resumen.datos : null;
}

function useConstelacion(id) {
  const [resultado, setResultado] = useState({ id: null, nombre: null });
  useEffect(() => {
    let activo = true;
    indiceBusqueda().then(indice => {
      const fila = indice.find(item => item.id === id);
      const sigla = fila?.aliases.map(alias => alias.match(/ ([A-Z][A-Za-z]{2})$/)?.[1]).find(valor => CONSTELACIONES[valor]);
      if (activo) setResultado({ id, nombre: sigla ? CONSTELACIONES[sigla] : null });
    }).catch(() => {});
    return () => { activo = false; };
  }, [id]);
  return resultado.id === id ? resultado.nombre : null;
}

// Disco de una estrella: la textura roja del Sol (304 Å), teñida con el color de su temperatura.
function DiscoEstrella({ id, cx, r, color }) {
  const [cr, cg, cb] = color;
  const lado = r * 2.36;
  return <g>
    <filter id={`${id}-tinte`} colorInterpolationFilters="sRGB">
      <feColorMatrix type="matrix" values={[cr, cg, cb].map(c => `${0.6 * c} ${c} 0 0 ${0.18 * c}`).join('  ') + '  0 0 0 1 0'} />
    </filter>
    <clipPath id={`${id}-disco`}><circle cx={cx} cy={38} r={r} /></clipPath>
    <circle cx={cx} cy={38} r={r} fill={`rgb(${color.map(v => Math.round(v * 255)).join(', ')})`} />
    <image href="/textures/sdo/0304.jpg" x={cx - lado / 2} y={38 - lado / 2} width={lado} height={lado} clipPath={`url(#${id}-disco)`} filter={`url(#${id}-tinte)`} />
  </g>;
}

// Tamaño comparado con el Sol: el mayor de los dos ocupa el recuadro; el menor nunca desaparece.
function ComparacionSol({ radio, temperatura }) {
  const id = useId().replace(/:/g, '');
  const mayor = Math.max(radio, 1), escala = 34 / mayor;
  const estrella = Math.max(1.5, radio * escala), sol = Math.max(1.5, escala);
  const texto = radio >= 1 ? `${numero(radio)} veces el radio del Sol` : `${numero(1 / radio)} veces más pequeña que el Sol`;
  return <figure className="ficha-estrella-comparacion">
    <svg viewBox="0 0 170 76" role="img" aria-label={texto}>
      <DiscoEstrella id={`${id}-e`} cx={46} r={estrella} color={temperatureColor(temperatura)} />
      <DiscoEstrella id={`${id}-s`} cx={126} r={sol} color={temperatureColor(5772)} />
    </svg>
    <figcaption><span>Esta estrella</span><span>Sol</span></figcaption>
    <p>{texto}</p>
  </figure>;
}

// Página de la estrella seleccionada dentro de la ficha lateral.
export default function FichaEstrella({ nombre, star, onVerSuperficie, onVerPlaneta, onVerExoplanetas, children }) {
  const resumen = useResumen(nombre);
  const constelacion = useConstelacion(star.i);
  const { physics, system, planetary } = star;
  const temperatura = physics?.temperatureK ?? temperaturaDesdeColor(star.c);
  const color = temperatura ? `rgb(${temperatureColor(temperatura).map(v => Math.round(v * 255)).join(', ')})` : '#fff';
  const luminosidad = physics?.luminositySolar ?? (Number.isFinite(star.m) ? 10 ** (0.4 * (4.83 - star.m)) : null);
  const anosLuz = star.d / LIGHT_YEAR_PC;
  const tipo = tipoEstelar(star.sp);
  const planetas = (planetary || []).flatMap(sistema => sistema.planets);
  const referencia = brilloDesdeLaTierra(star, nombre);
  return <>
      <h2 className="marca-hoshi" style={temperatura ? { color: colorLegible(temperatura) } : undefined}>{nombre}</h2>
      {tipo && <p className="ficha-estrella-tipo">{tipo.nombre}{` · ${star.sp.replace(/\.+\s*$/, '').trim()}`}</p>}
      {tipo && <p className="ficha-estrella-relato">{tipo.texto}</p>}
      {physics?.radiusSolar > 0 && <ComparacionSol radio={physics.radiusSolar} temperatura={temperatura || 5772} />}
      <dl>
        {temperatura && <Dato etiqueta="Temperatura" valor={`${Math.round(temperatura).toLocaleString('es-CL')} K`} secundario={`${Math.round(temperatura - 273.15).toLocaleString('es-CL')} °C`}>
          <i className="ficha-estrella-color" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
        </Dato>}
        {physics?.radiusSolar > 0 && <Dato etiqueta="Radio" valor={`${numero(physics.radiusSolar)} R☉`} />}
        {planetary?.[0]?.st?.m > 0 && <Dato etiqueta="Masa" valor={`${numero(planetary[0].st.m)} M☉`} />}
        {luminosidad > 0 && <Dato etiqueta="Luminosidad" valor={`${numero(luminosidad)} L☉`} />}
        {referencia && <Dato etiqueta="Desde la Tierra" valor={referencia} />}
        <Dato etiqueta="Distancia al Sol" valor={`${numero(anosLuz, anosLuz < 100 ? 3 : 2)} años luz`} />
        {constelacion && <Dato etiqueta="Constelación" valor={constelacion} />}
      </dl>
      {system?.components?.length > 1 && <p className="ficha-estrella-relato">No está sola: forma un sistema múltiple de {system.components.length} estrellas ligadas por su gravedad.</p>}
      {planetas.length > 0 && <section>
        <h3>{planetas.length === 1 ? 'Un planeta conocido' : `${planetas.length} planetas conocidos`}</h3>
        <ul className="ficha-estrella-planetas">
          {planetas.slice(0, 12).map(planeta => <li key={planeta.n}>
            {planeta.body ? <button onClick={() => onVerPlaneta(planeta.body)}>{planeta.n}</button> : <span>{planeta.n}</span>}
          </li>)}
        </ul>
        <button className="ficha-estrella-enlace" onClick={onVerExoplanetas}>✦ Ver en Exoplanetas</button>
      </section>}
      {resumen && <section className="ficha-estrella-wikipedia">
        <p>{resumen.texto}</p>
      </section>}
      {physics?.derivada && <p className="ficha-estrella-fuente">Radio estimado por su brillo y su temperatura.</p>}
      {onVerSuperficie && physics && <button className="ficha-estrella-accion" onClick={onVerSuperficie}>Ver superficie</button>}
      {(children || resumen) && <details className="ficha-estrella-tecnico"><summary>Datos técnicos y fuentes</summary>{children}
        {/* La licencia CC BY-SA del resumen exige citar su origen; va aquí, sin ocupar la ficha. */}
        {resumen && <div>Texto: <a href={resumen.enlace} target="_blank" rel="noreferrer">Wikipedia</a> (CC BY-SA)</div>}
      </details>}
  </>;
}
