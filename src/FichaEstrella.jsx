import { useEffect, useId, useState } from 'react';
import { colorLegible, temperatureColor } from './scene/stellarPhysics';
import { LIGHT_YEAR_PC } from './scene/scale';
import { indiceBusqueda } from './indiceBusqueda';
import { CONSTELACIONES } from './constelaciones';
import textos from '../data/processed/textos_fichas.json';
import { estrellaDeComponente } from './scene/visualBinary';
import { Dato } from './FichaLateral';
import MapaZonaHabitable from './MapaZona';
import { useFichas } from './useFichas';
import { tipoEstelar } from './tipoEstelar';
import { orbitaCompleta } from './scene/orbitasPar';
import { gruposSistema } from './scene/gruposSistema';
import EsquemaSistema from './EsquemaSistema';
import { nombreParaMostrar } from './scene/nombresEstrella';
import { GENITIVOS } from './scene/starSearch';
import { magnitudesFicha } from './scene/magnitudesFicha';
import './fichaSistema.css';


const mostrar = nombre => nombreParaMostrar(nombre, GENITIVOS);
const numero = (valor, digitos = 3) => valor.toLocaleString('es-CL', { maximumSignificantDigits: digitos });

// Lo que une a una compañera con su estrella, solo con los datos del sistema (star_systems): con órbita,
// su período (p, en días) y semieje (a, en UA); en un par ancho, la separación proyectada (rho, en UA).
// Las compañeras espectroscópicas ocultas no forman parte de `components` y no se listan.
function unionDelPar(c, nombrePrimaria) {
  const { pair } = c;
  const enana = /^[LTY]\d/.test(pair.sp || '') ? `Enana café ${pair.sp}` : null;
  const padre = mostrar(pair.of === 'A' ? nombrePrimaria : `${nombrePrimaria} ${pair.of}`);
  const enlace = pair.k === 'o' && pair.p > 0 && pair.a > 0 ? `Órbita de ${numero(pair.p / 365.25, 3)} años · ${numero(pair.a, 2)} UA`
    : pair.k !== 'o' && pair.rho > 0 ? `A ${numero(pair.rho, 2)} UA de ${padre} · viaja con el sistema` : null;
  return [enana, enlace].filter(Boolean).join(' · ') || null;
}

// Las demás estrellas de su sistema; una compañera sin registro propio se completa con el dato del par.
// `titulos`: id → título en el buscador (el mismo de su ficha), para las estrellas sin nombre propio (61 Cyg).
function componentesDelSistema(star, nombre, titulos) {
  const sistema = star.system || star.sistemaDe;
  if (!sistema) return [];
  const primaria = sistema.star;
  const titulo = estrella => estrella && (titulos.get(estrella.i) || estrella.n);
  const nombrePrimaria = titulo(primaria) || 'Estrella principal';
  return [{ star: primaria, nombre: nombrePrimaria }, ...sistema.components.map(c => ({
    nombre: titulo(c.companion) || `${nombrePrimaria} ${c.name}`,
    star: estrellaDeComponente(sistema, c),
    detalle: unionDelPar(c, nombrePrimaria),
  }))].filter(miembro => miembro.star !== star && miembro.nombre !== nombre);
}

// Títulos del buscador de las estrellas de un sistema.
function useTitulos(star) {
  const sistema = star.system || star.sistemaDe;
  const ids = sistema ? [sistema.star, ...sistema.components.map(c => c.companion)].filter(Boolean).map(s => s.i) : [];
  const clave = ids.join(',');
  const [titulos, setTitulos] = useState({ clave: null, mapa: new Map() });
  useEffect(() => {
    if (!clave) return undefined;
    let activo = true;
    const buscados = new Set(clave.split(',').map(Number));
    indiceBusqueda().then(indice => {
      const mapa = new Map(indice.filter(item => buscados.has(item.id)).map(item => [item.id, item.aliases[0]]));
      if (activo) setTitulos({ clave, mapa });
    }).catch(() => {});
    return () => { activo = false; };
  }, [clave]);
  return titulos.clave === clave ? titulos.mapa : new Map();
}

// Sistema de la estrella: un esquema con la pareja que se orbita y las compañeras lejanas, y debajo los
// dos grupos con sus nombres. Si el sistema no se puede agrupar (sin datos del par), queda la lista simple.
function SeccionSistema({ star, nombre, miembros, titulos, onVerComponente, onVerOrbitas }) {
  const { pares, lejanas } = gruposSistema(star.system || star.sistemaDe, estrella => mostrar(titulos.get(estrella.i) || estrella.n));
  const esActual = m => m.star === star || m.nombre === mostrar(nombre);
  // Cada nombre en el color de su estrella en el cielo; la de la ficha, en negrita y sin enlace.
  const nombreDe = m => {
    const color = { color: `rgb(${m.color.join(', ')})` };
    return esActual(m) ? <strong className="ficha-sistema-actual" style={color}>{m.nombre}</strong>
      : <button className="ficha-sistema-enlace ficha-sistema-nombre" style={color} onClick={() => onVerComponente(m.star, m.nombre)}>{m.nombre}</button>;
  };
  const parEsquema = pares.find(p => p.periodo && p.a) || null;
  const lejanasEsquema = lejanas.filter(l => !parEsquema || l.par === parEsquema || l.de === parEsquema.uno);
  const conEsquema = (parEsquema || lejanasEsquema.length) && lejanasEsquema.length <= 3;
  if (!pares.length && !lejanas.length) return <section>
    <h3>Sistema</h3>
    <ul className="ficha-estrella-planetas ficha-estrella-miembros">
      {miembros.map(miembro => <li key={miembro.nombre}><button onClick={() => onVerComponente(miembro.star, miembro.nombre)}>{mostrar(miembro.nombre)}</button>
        {miembro.detalle && <small>{miembro.detalle}</small>}</li>)}
    </ul>
  </section>;
  return <section className="ficha-sistema">
    <h3>Sistema</h3>
    {conEsquema && <EsquemaSistema par={parEsquema} lejanas={parEsquema ? lejanasEsquema : lejanasEsquema.slice(0, 3)} actual={star} />}
    <ul className="ficha-sistema-arbol">
      {pares.map(p => <li key={p.clave}>
        <p>{nombreDe(p.uno)} <span className="ficha-sistema-signo" aria-label="se orbita con">⟲</span> {nombreDe(p.otro)}</p>
        {p.periodo && p.a && <small>Se orbitan cada {numero(p.periodo, 3)} años (distancia media {numero(p.a, 2)} UA)</small>}
        {onVerOrbitas && orbitaCompleta(p.pair) && <button className="ficha-sistema-enlace ficha-sistema-orbitas" onClick={() => onVerOrbitas(p.clave, [p.uno.nombre, p.otro.nombre])}>Ver órbitas</button>}
      </li>)}
      {lejanas.map(l => <li key={l.miembro.nombre}>
        <p>{nombreDe(l.miembro)}</p>
        <small>{l.par ? 'Viaja con el par' : <>Viaja junto a {nombreDe(l.de)}</>}{l.rho && ` · ${numero(l.rho, 2)} UA`}</small>
      </li>)}
    </ul>
  </section>;
}

// Cómo se ve desde la Tierra, según su magnitud aparente.
function comoSeVe(star) {
  const magnitudes = magnitudesFicha(star);
  if (!magnitudes) return null;
  const magnitud = magnitudes.aparente;
  const frase = magnitud < 0 ? 'Desde la Tierra es una de las estrellas más brillantes del cielo nocturno.'
    : magnitud < 3 ? 'Desde la Tierra se ve a simple vista, incluso desde la ciudad.'
    : magnitud < 6 ? 'Desde la Tierra se ve a simple vista solo con cielo oscuro.'
    : magnitud < 9 ? 'Desde la Tierra necesitas binoculares para verla.' : 'Desde la Tierra solo se ve con telescopio.';
  return { frase, aparente: magnitud };
}

function useConstelacion(id) {
  const [resultado, setResultado] = useState({ id: null });
  useEffect(() => {
    let activo = true;
    indiceBusqueda().then(indice => {
      const fila = indice.find(item => item.id === id);
      const sigla = fila?.aliases.map(alias => alias.match(/ ([A-Z][A-Za-z]{2})$/)?.[1]).find(valor => CONSTELACIONES[valor]);
      const designacion = prefijo => fila?.aliases.find(alias => alias.startsWith(`${prefijo} `));
      // Nombre de estrella variable del GCVS vía SIMBAD («VY CMa», «V1234 Sgr»), si tiene.
      const variable = fila?.aliases.find(alias => /^(V\d+|[A-Z]{1,2}) [A-Z][A-Za-z]{2}$/.test(alias));
      if (activo) setResultado({ id, constelacion: sigla ? CONSTELACIONES[sigla] : null, hd: designacion('HD'), hip: designacion('HIP'),
        hr: designacion('HR'), gliese: designacion('Gl') || designacion('GJ'), variable });
    }).catch(() => {});
    return () => { activo = false; };
  }, [id]);
  return resultado.id === id ? resultado : {};
}

// Disco de una estrella: la textura roja del Sol (304 Å), teñida con el color de su temperatura.
function DiscoEstrella({ id, cx, r, color }) {
  const [cr, cg, cb] = color;
  const lado = r * 2.36;
  return <g>
    <filter id={`${id}-tinte`} colorInterpolationFilters="sRGB">
      <feColorMatrix type="matrix" values={[cr, cg, cb].map(c => `${1.05 * c} ${1.6 * c} 0 0 ${0.3 * c}`).join('  ') + '  0 0 0 1 0'} />
    </filter>
    <clipPath id={`${id}-disco`}><circle cx={cx} cy={38} r={r} /></clipPath>
    <circle cx={cx} cy={38} r={r} fill={`rgb(${color.map(v => Math.round(v * 255)).join(', ')})`} />
    <image href="/textures/sdo/0304.jpg" x={cx - lado / 2} y={38 - lado / 2} width={lado} height={lado} clipPath={`url(#${id}-disco)`} filter={`url(#${id}-tinte)`} />
  </g>;
}

// Tamaño comparado con el Sol: el mayor de los dos ocupa el recuadro; el menor nunca desaparece.
function ComparacionSol({ nombre, radio, temperatura }) {
  const id = useId().replace(/:/g, '');
  const mayor = Math.max(radio, 1), escala = 34 / mayor;
  const estrella = Math.max(1.5, radio * escala), sol = Math.max(1.5, escala);
  const texto = radio >= 1 ? `${numero(radio)} veces el radio del Sol` : `${numero(1 / radio)} veces más pequeña que el Sol`;
  return <figure className="ficha-estrella-comparacion">
    <svg viewBox="0 0 170 76" role="img" aria-label={texto}>
      <DiscoEstrella id={`${id}-e`} cx={46} r={estrella} color={temperatureColor(temperatura)} />
      <DiscoEstrella id={`${id}-s`} cx={126} r={sol} color={temperatureColor(5772)} />
    </svg>
    <figcaption><span>{nombre}</span><span>Sol</span></figcaption>
    <p>{texto}</p>
  </figure>;
}

// Página de la estrella seleccionada dentro de la ficha lateral.
// `cumuloDe`: cúmulo globular del que es miembro ({ nombre, d }): se muestra la distancia del cúmulo (build_globulares.js).
export default function FichaEstrella({ nombre, star, onVerSuperficie, onVerPlaneta, onVerComponente, onZona, onVerOrbitas, irA, cumuloDe = null }) {
  const { constelacion, hd, hip, hr, gliese, variable } = useConstelacion(star.i);
  const fichas = useFichas();
  const mas = { ...fichas?.estrellas[star.i], ...fichas?.anfitrionas[star.planetary?.[0]?.name] };
  const movimiento = mas.pmRa !== undefined && mas.pmDec !== undefined ? Math.hypot(mas.pmRa, mas.pmDec) : null;
  const metales = mas.metalicidad;
  const { physics, planetary } = star;
  const datos = star.datos;
  const temperatura = physics?.temperatureK ?? datos?.temperatureK;
  const radio = physics?.radiusSolar ?? datos?.radiusSolar;
  const masa = planetary?.[0]?.st?.m ?? datos?.massSolar;
  const espectro = star.sp || datos?.espectro;
  const fuentes = Object.entries({ temperatura: datos?.fuentes.temperatureK, radio: datos?.fuentes.radiusSolar, masa: datos?.fuentes.massSolar, luminosidad: datos?.fuentes.luminositySolar }).filter(([, fuente]) => fuente);
  const titulos = useTitulos(star);
  const miembros = componentesDelSistema(star, nombre, titulos);
  const color = temperatura ? `rgb(${temperatureColor(temperatura).map(v => Math.round(v * 255)).join(', ')})` : '#fff';
  const luminosidad = physics?.luminositySolar ?? datos?.luminositySolar ?? mas.luminosidad;
  const magnitudes = magnitudesFicha(star, cumuloDe);
  const anosLuz = (magnitudes?.distanciaPc ?? star.d) / LIGHT_YEAR_PC;
  const tipo = tipoEstelar(espectro);
  const planetas = (planetary || []).flatMap(sistema => sistema.planets);
  const vista = comoSeVe(star);
  return <>
      <h2 className="marca-hoshi" style={temperatura ? { color: colorLegible(temperatura) } : undefined}>{mostrar(nombre)}</h2>
      {irA && <button className="ficha-ir-a" onClick={irA.onIr}>{irA.texto}</button>}
      {tipo && <p className="ficha-estrella-tipo">{tipo.nombre}{` · ${espectro.replace(/\.+\s*$/, '').trim()}`}</p>}
      {/* Texto propio de la estrella si lo tiene; si no, el de su tipo. */}
      {(textos.estrellas[star.n] || tipo || vista) && <p className="ficha-estrella-relato">{[textos.estrellas[star.n] || tipo?.texto, vista?.frase].filter(Boolean).join(' ')}</p>}
      {radio > 0 && <ComparacionSol nombre={mostrar(nombre)} radio={radio} temperatura={temperatura || 5772} />}
      {onVerSuperficie && physics && <div className="ficha-estrella-superficie"><button className="ficha-estrella-accion" onClick={onVerSuperficie}>Ver superficie</button></div>}
      <dl>
        {temperatura && <Dato etiqueta="Temperatura" valor={`${Math.round(temperatura).toLocaleString('es-CL')} K`} secundario={`${Math.round(temperatura - 273.15).toLocaleString('es-CL')} °C`}>
          <i className="ficha-estrella-color" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
        </Dato>}
        {radio > 0 && <Dato etiqueta="Radio" valor={`${numero(radio)} R☉`} />}
        {masa > 0 && <Dato etiqueta="Masa" valor={`${numero(masa)} M☉`} />}
        {luminosidad > 0 && <Dato etiqueta="Luminosidad" valor={`${numero(luminosidad)} L☉`} />}
        {vista && <Dato etiqueta="Magnitud aparente" valor={numero(vista.aparente, 3)} />}
        {magnitudes && <Dato etiqueta="Magnitud absoluta" valor={numero(magnitudes.absoluta, 3)} />}
        {/* Miembro de un cúmulo globular: la distancia del cúmulo, con 3 cifras como en su ficha. */}
        <Dato etiqueta="Distancia al Sol" valor={`${numero(anosLuz, cumuloDe || anosLuz < 100 ? 3 : 2)} años luz`}
          secundario={cumuloDe ? `${numero(cumuloDe.d / 1000, 3)} kpc · distancia del cúmulo ${cumuloDe.nombre}` : undefined} />
        {constelacion && <Dato etiqueta="Constelación" valor={constelacion} />}
        {mas.paralaje > 0 && <Dato etiqueta="Paralaje" valor={`${numero(mas.paralaje)}${mas.paralajeError ? ` ± ${numero(mas.paralajeError, 2)}` : ''} mas`} />}
        {mas.edad > 0 && <Dato etiqueta="Edad" valor={`${numero(mas.edad, 2)} mil millones de años`} secundario="Sol: 4,6" />}
        {mas.etapa > 0 && <Dato etiqueta="Fase" valor={mas.etapa <= 360 ? 'Secuencia principal' : mas.etapa <= 420 ? 'Subgigante' : 'Gigante'} />}
        {metales !== undefined && <Dato etiqueta="Metalicidad [Fe/H]" valor={numero(metales, 2)} secundario={metales > 0.05 ? 'Más elementos pesados que el Sol' : metales < -0.05 ? 'Menos elementos pesados que el Sol' : 'Como el Sol'} />}
        {mas.gravedad > 0 && <Dato etiqueta="Gravedad superficial" valor={`log g ${numero(mas.gravedad)}`} secundario="Sol: 4,44" />}
        {mas.rotacion > 0 && <Dato etiqueta="Rotación" valor={`${numero(mas.rotacion)} días`} secundario="Sol: ~25" />}
        {mas.radial !== undefined && <Dato etiqueta="Velocidad radial" valor={`${mas.radial < 0 ? 'Se acerca' : 'Se aleja'} a ${numero(Math.abs(mas.radial))} km/s`} />}
        {movimiento > 0 && <Dato etiqueta="Movimiento propio" valor={`${numero(movimiento)} mas/año`} />}
        {(hd || hip || mas.gaia || variable) && <Dato etiqueta="Catálogos" valor={[variable, hd, hip, hr, gliese].filter(Boolean).join(' · ')} secundario={mas.gaia ? `Gaia DR3 ${mas.gaia}` : undefined} />}
      </dl>
      <MapaZonaHabitable star={star} nombre={nombre} fichas={fichas} planetas={planetas} temperatura={temperatura} masa={masa} comparar onMostrar={onZona} />
      {miembros.length > 0 && <SeccionSistema star={star} nombre={nombre} miembros={miembros} titulos={titulos} onVerComponente={onVerComponente} onVerOrbitas={onVerOrbitas} />}
      {planetas.length > 0 && <section>
        <h3>{planetas.length === 1 ? 'Un planeta conocido' : `${planetas.length} planetas conocidos`}</h3>
        <ul className="ficha-estrella-planetas">
          {planetas.slice(0, 12).map(planeta => <li key={planeta.n}>
            {planeta.body ? <button onClick={() => onVerPlaneta(planeta.body)}>{planeta.n}</button> : <span>{planeta.n}</span>}
          </li>)}
        </ul>
      </section>}
      {fuentes.length > 0 && <p className="ficha-estrella-fuente">Datos: {[...new Set(fuentes.map(([, fuente]) => fuente))].join(' · ')}</p>}
  </>;
}
