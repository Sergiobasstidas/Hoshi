import { useEffect, useId, useMemo, useState } from 'react';
import { colorLegible, temperatureColor } from './scene/stellarPhysics';
import { LIGHT_YEAR_PC } from './scene/scale';
import { indiceBusqueda } from './indiceBusqueda';
import { CONSTELACIONES } from './constelaciones';
import { estrellaDeComponente } from './scene/visualBinary';
import { Dato } from './FichaLateral';
import MapaZonaHabitable from './MapaZona';
import { useFichas } from './useFichas';
import { useTiposRevisados } from './useTiposRevisados';
import { useTextosFichas } from './useTextosFichas';
import { tipoEstelar } from './tipoEstelar';
import { orbitaCompleta } from './scene/orbitasPar';
import MapaSistema from './MapaSistema';
import { fraseOcultas, mapaSistema, tiempoLuz } from './scene/mapaSistema';
import { anoActual } from './scene/orbitasPar';
import { nombreEstrella, nombreEstrellaCrudo, nombreParaMostrar } from './scene/nombresEstrella';
import { useTitulos } from './scene/titulos';
import { GENITIVOS } from './scene/starSearch';
import { magnitudesFicha } from './scene/magnitudesFicha';
import { fuentesSinRepetir } from './fuentesFicha';
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

// Las demás estrellas de su sistema; una compañera sin registro propio se completa con el dato del par. Los nombres,
// de nombreEstrella (nombresEstrella.js). Se compara por estrella y no por nombre: en p Eridani las dos se llaman igual.
function componentesDelSistema(star) {
  const sistema = star.system || star.sistemaDe;
  if (!sistema) return [];
  const primaria = sistema.star;
  const nombrePrimaria = nombreEstrellaCrudo(primaria) || 'Estrella principal';
  return [{ star: primaria, nombre: nombreEstrella(primaria) }, ...sistema.components.map(c => ({
    nombre: nombreEstrella(estrellaDeComponente(sistema, c)),
    star: estrellaDeComponente(sistema, c),
    detalle: unionDelPar(c, nombrePrimaria),
  }))].filter(miembro => miembro.star !== star);
}

// Sistema de la estrella: el mapa del cielo a escala (MapaSistema.jsx) y debajo, en palabras, cada órbita y
// a qué distancia está cada estrella de la que se está viendo. Sin datos para el mapa, queda la lista simple.
function SeccionSistema({ star, miembros, onVerComponente, onVerOrbitas, cumulo }) {
  const sistema = star.system || star.sistemaDe;
  const mapa = useMemo(() => mapaSistema(sistema, anoActual()), [sistema]);
  const esActual = m => m.star === star;
  // Cada nombre en el color de su estrella en el cielo; la de la ficha, en negrita y sin enlace.
  const nombreDe = m => {
    const color = { color: `rgb(${m.color.join(', ')})` };
    return esActual(m) ? <strong className="ficha-sistema-actual" style={color}>{m.nombre}</strong>
      : <button className="ficha-sistema-enlace ficha-sistema-nombre" style={color} onClick={() => onVerComponente(m.star, m.nombre)}>{m.nombre}</button>;
  };
  if (!mapa || mapa.estrellas.length < 2) return <section>
    <h3>Sistema</h3>
    <ul className="ficha-estrella-planetas ficha-estrella-miembros">
      {miembros.map(miembro => <li key={miembro.star.i}><button onClick={() => onVerComponente(miembro.star, miembro.nombre)}>{mostrar(miembro.nombre)}</button>
        {miembro.detalle && <small>{miembro.detalle}</small>}</li>)}
    </ul>
  </section>;
  const aqui = mapa.estrellas.find(e => e.star === star) || mapa.porLetra.A;
  // Con distancias iguales, la estrella padre antes que su compañera (Alcor antes que Alcor B).
  const profundidad = e => { let n = 0; for (let x = e; x?.de; x = mapa.porLetra[x.de]) n++; return n; };
  const anchas = mapa.estrellas.filter(e => e.de && !mapa.pares.some(p => p.otro === e.letras[0]));
  const anos = anchas.map(e => e.pair.year).filter(Boolean);
  const periodo = anos => anos < 1 ? `${numero(anos * 365.25, 3)} días` : `${numero(anos, 3)} años`;
  // En un cúmulo, compañeras anchas sin órbita son vecinas: no se sabe si giran juntas.
  const vecinas = cumulo && mapa.pares.length === 0;
  return <section className="ficha-sistema">
    <h3>{vecinas ? 'Vecinas' : 'Sistema'}</h3>
    <MapaSistema mapa={mapa} actual={star} />
    <ul className="ficha-sistema-lista">
      {mapa.pares.map(par => {
        const uno = mapa.porLetra[par.uno], otro = mapa.porLetra[par.otro];
        const hoy = Math.hypot(otro.este - uno.este, otro.norte - uno.norte);
        return <li key={`${par.uno}>${par.otro}`}>
          <p>{nombreDe(otro)} gira en torno a {nombreDe(uno)} cada {periodo(par.periodo)}.</p>
          <small>Hoy se ven a {numero(hoy, 2)} UA; {numero(par.pair.a * (1 - par.pair.e), 2) === numero(par.pair.a * (1 + par.pair.e), 2)
            ? `en su órbita real están siempre a unas ${numero(par.pair.a, 2)} UA.`
            : `en su órbita real van de ${numero(par.pair.a * (1 - par.pair.e), 2)} a ${numero(par.pair.a * (1 + par.pair.e), 2)} UA.`}</small>
          {onVerOrbitas && orbitaCompleta(par.pair) && <button className="ficha-sistema-enlace ficha-sistema-orbitas" onClick={() => onVerOrbitas(`${par.uno}>${par.otro}`, [uno.nombre, otro.nombre])}>Ver órbitas</button>}
        </li>;
      })}
      {mapa.estrellas.filter(e => e !== aqui).map(e => ({ e, ua: Math.hypot(e.este - aqui.este, e.norte - aqui.norte) }))
        .sort((x, y) => x.ua - y.ua || profundidad(x.e) - profundidad(y.e)).map(({ e, ua }) => {
        return <li key={e.letras.join('/')}>
          <p>{nombreDe(e)}{e.letras.length > 1 && <span className="ficha-sistema-signo"> ({e.letras.join('/')})</span>} · a {numero(ua, 2)} UA · {tiempoLuz(ua)}</p>
        </li>;
      })}
      {mapa.estrellas.filter(e => e.ocultas.length).map(e => <li key={`ocultas-${e.letras[0]}`}>
        <p>+{e.ocultas.length} · {fraseOcultas(e.nombre, e.ocultas)}</p>
      </li>)}
    </ul>
    {vecinas && <p className="ficha-sistema-nota">{mapa.porLetra.A.nombre} es parte de {/^(Pléyades|Híades)$/.test(cumulo.nombre) ? `las ${cumulo.nombre}` : cumulo.nombre}, un cúmulo de {cumulo.miembros >= 1000 ? 'más de mil' : `unas ${cumulo.miembros}`} estrellas que viajan juntas: verse cerca no prueba que giren juntas. No se sabe.</p>}
    <p className="ficha-sistema-nota">Como en un mapa del cielo: norte arriba, este a la izquierda.{anos.length > 0 && ` Distancias medidas en el cielo (${Math.min(...anos) === Math.max(...anos) ? Math.min(...anos) : `${Math.min(...anos)}–${Math.max(...anos)}`}): las reales pueden ser mayores.`}</p>
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
      // Bonner Durchmusterung («BD-12 5055») y catálogo infrarrojo de dos micras («IRC -10422»), si los tiene.
      const bd = fila?.aliases.find(alias => /^BD[+-]\d/.test(alias));
      const gaia = fila?.aliases.find(alias => alias.startsWith('Gaia DR3 '))?.slice(9);
      if (activo) setResultado({ id, constelacion: sigla ? CONSTELACIONES[sigla] : null, hd: designacion('HD'), hip: designacion('HIP'),
        hr: designacion('HR'), gliese: designacion('Gl') || designacion('GJ'), bd, irc: designacion('IRC'), variable, gaia });
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
export default function FichaEstrella({ nombre, star, onVerSuperficie, onVerPlaneta, onVerComponente, onZona, onVerOrbitas, irA, cumuloDe = null, cumuloSistema = null }) {
  const { constelacion, hd, hip, hr, gliese, bd, irc, variable, gaia: gaiaBuscador } = useConstelacion(star.i);
  const fichas = useFichas();
  const mas = { ...fichas?.estrellas[star.i], ...fichas?.anfitrionas[star.planetary?.[0]?.name] };
  const movimiento = mas.pmRa !== undefined && mas.pmDec !== undefined ? Math.hypot(mas.pmRa, mas.pmDec) : null;
  const metales = mas.metalicidad;
  const { physics, planetary } = star;
  const datos = star.datos;
  const temperatura = physics?.temperatureK ?? datos?.temperatureK;
  const radio = physics?.radiusSolar ?? datos?.radiusSolar;
  const masa = planetary?.[0]?.st?.m ?? datos?.massSolar;
  // Tipo revisado (build_tipos_revisados.js): curado, solo el color de la letra si contradice el brillo, o nombre y texto
  // neutros para una G, K o M sin clase creíble.
  // Se cargan al abrir la primera ficha; mientras tanto no se muestra la línea de tipo ni el texto genérico, para que no
  // cambien al llegar.
  const tiposRevisados = useTiposRevisados();
  const textos = useTextosFichas();
  const revisado = tiposRevisados?.estrellas[star.i] || (tiposRevisados?.neutras.has(star.i) ? { usado: star.sp || datos?.espectro, neutra: true } : null);
  const espectro = revisado ? revisado.usado || revisado.catalogo : star.sp || datos?.espectro;
  const sinClase = Boolean(revisado) && !revisado.usado;
  const fuentes = Object.entries({ temperatura: datos?.fuentes.temperatureK, radio: datos?.fuentes.radiusSolar, masa: datos?.fuentes.massSolar, luminosidad: datos?.fuentes.luminositySolar }).filter(([, fuente]) => fuente);
  const gaia = mas.gaia || gaiaBuscador;
  useTitulos();
  const miembros = componentesDelSistema(star);
  const color = temperatura ? `rgb(${temperatureColor(temperatura).map(v => Math.round(v * 255)).join(', ')})` : '#fff';
  const luminosidad = physics?.luminositySolar ?? datos?.luminositySolar ?? mas.luminosidad;
  const magnitudes = magnitudesFicha(star, cumuloDe);
  const anosLuz = (magnitudes?.distanciaPc ?? star.d) / LIGHT_YEAR_PC;
  const tipo = tiposRevisados === undefined ? null : tipoEstelar(espectro, { sinClase, neutra: Boolean(revisado?.neutra) });
  const planetas = (planetary || []).flatMap(sistema => sistema.planets);
  const vista = comoSeVe(star);
  return <>
      <h2 className="marca-hoshi" style={temperatura ? { color: colorLegible(temperatura) } : undefined}>{mostrar(nombre)}</h2>
      {irA && <button className="ficha-ir-a" onClick={irA.onIr}>{irA.texto}</button>}
      {tipo && <p className="ficha-estrella-tipo">{tipo.nombre}{sinClase ? '' : ` · ${espectro.replace(/\.+\s*$/, '').trim()}`}</p>}
      {/* Texto propio de la estrella si lo tiene; si no, el de su tipo. */}
      {textos && (textos.estrellas[star.n] || (tiposRevisados !== undefined && (tipo || vista))) && <p className="ficha-estrella-relato">{[textos.estrellas[star.n] || tipo?.texto, vista?.frase].filter(Boolean).join(' ')}</p>}
      {radio > 0 && <ComparacionSol nombre={mostrar(nombre)} radio={radio} temperatura={temperatura || 5772} />}
      {/* Con radio medido o de catálogo; sin temperatura medida, la esfera usa la de su tipo o color (fisicaDibujo.js), que la ficha no muestra. */}
      {onVerSuperficie && (physics || datos?.radiusSolar > 0) && <div className="ficha-estrella-superficie"><button className="ficha-estrella-accion" onClick={onVerSuperficie}>Ver superficie</button></div>}
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
        {(hd || hip || bd || irc || gaia || variable) && <Dato etiqueta="Catálogos" valor={[variable, hd, hip, hr, gliese, bd, irc].filter(Boolean).join(' · ')} secundario={gaia ? `Gaia DR3 ${gaia}` : undefined} />}
      </dl>
      <MapaZonaHabitable star={star} nombre={nombre} fichas={fichas} planetas={planetas} temperatura={temperatura} masa={masa} comparar onMostrar={onZona} />
      {miembros.length > 0 && <SeccionSistema star={star} miembros={miembros} onVerComponente={onVerComponente} onVerOrbitas={onVerOrbitas} cumulo={cumuloSistema} />}
      {planetas.length > 0 && <section>
        <h3>{planetas.length === 1 ? 'Un planeta conocido' : `${planetas.length} planetas conocidos`}</h3>
        <ul className="ficha-estrella-planetas">
          {planetas.slice(0, 12).map(planeta => <li key={planeta.n}>
            {planeta.body ? <button onClick={() => onVerPlaneta(planeta.body)}>{planeta.n}</button> : <span>{planeta.n}</span>}
          </li>)}
        </ul>
      </section>}
      {fuentes.length > 0 && <p className="ficha-estrella-fuente">Datos: {fuentesSinRepetir(fuentes.map(([, fuente]) => fuente)).join(' · ')}</p>}
  </>;
}
