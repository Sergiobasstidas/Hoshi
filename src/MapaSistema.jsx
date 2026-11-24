import { useEffect, useMemo, useRef } from 'react';
import { anoActual } from './scene/orbitasPar';
import { curvaOrbita, nivelesMapa, posicionEnOrbita, reglaDe } from './scene/mapaSistema';

const ANCHO = 300, MARGEN = 22, SEGUNDOS_POR_VUELTA = 16;
const rgb = c => `rgb(${c.join(',')})`;
const numero = v => v.toLocaleString('es-CL', { maximumSignificantDigits: 3 });
const periodoTexto = anos => anos < 1 ? `${numero(anos * 365.25)} días` : `${numero(anos)} años`;
const juntar = lista => lista.length === 1 ? lista[0] : `${lista.slice(0, -1).join(', ')} y ${lista.at(-1)}`;

// Rótulo corto junto a cada punto: la letra del catálogo si el nombre es «primaria + letra», o el nombre propio.
function rotuloCorto(estrella, primaria) {
  if (estrella.etiqueta) return estrella.etiqueta;
  const base = primaria?.nombre;
  if (estrella.de && base && estrella.nombre?.startsWith(`${base} `)) return estrella.nombre.slice(base.length + 1);
  return estrella.nombre;
}

// Geometría de un nivel: escala y desplazamiento para que sus marcas y órbitas quepan en el ancho.
function encuadre(nivel, mapa, maxAlto = 150) {
  const de = l => mapa.porLetra[l];
  const puntos = nivel.marcas.map(m => [de(m.letra).este, de(m.letra).norte]);
  for (const par of nivel.orbitas) {
    const base = de(par.uno);
    for (const [e, n] of curvaOrbita(par.pair, 48)) puntos.push([base.este + e, base.norte + n]);
  }
  const xs = puntos.map(p => -p[0]), ys = puntos.map(p => -p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const w = Math.max(x1 - x0, nivel.span * 0.05, 1e-9), h = Math.max(y1 - y0, nivel.span * 0.05, 1e-9);
  const altoUtil = Math.max(56, Math.min(maxAlto, (ANCHO - 2 * MARGEN) * h / w));
  const escala = Math.min((ANCHO - 2 * MARGEN) / w, altoUtil / h);
  const H = altoUtil + 2 * MARGEN + (nivel.orbitas.length ? 10 : 0);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return { escala, H, anchoUa: ANCHO / escala, punto: ([e, n]) => [ANCHO / 2 + (-e - cx) * escala, H / 2 + (-n - cy) * escala] };
}

// Un nivel del mapa: estrellas (o grupos) en su lugar del cielo, órbitas con su sentido de giro y la regla.
function Nivel({ nivel, mapa, actual, refs, maxAlto, compas, y = 0, recuadro }) {
  const de = l => mapa.porLetra[l];
  const primaria = mapa.porLetra.A;
  const g = encuadre(nivel, mapa, maxAlto);
  const regla = reglaDe(g.anchoUa), largo = regla.ua * g.escala;
  // La brújula va arriba a la derecha, salvo que ahí haya una estrella: entonces abajo a la derecha.
  const compasAbajo = nivel.marcas.some(m => { const [px, py] = g.punto([de(m.letra).este, de(m.letra).norte]); return px > ANCHO - 110 && py < 44; });
  const acelerado = nivel.orbitas.length > 0
    ? `Acelerado: 1 vuelta (${juntar(nivel.orbitas.map(p => periodoTexto(p.periodo)))}) en ${SEGUNDOS_POR_VUELTA} s` : null;
  return <g transform={`translate(0 ${y})`}>
    {recuadro && <rect x="0.5" y="0.5" width={ANCHO - 1} height={g.H - 1} rx="4" className="mapa-sistema-recuadro" />}
    {compas && <g transform={`translate(${ANCHO - 16} ${compasAbajo ? g.H - 26 : 16})`} className="mapa-sistema-compas">
      <path d="M0 8 V-6 M-2.5 -3 L0 -6 L2.5 -3" /><text x="0" y="-9" textAnchor="middle">N</text>
      <path d="M8 8 H-6" /><text x="-10" y="11" textAnchor="end">E</text>
    </g>}
    {nivel.orbitas.map(par => {
      const base = de(par.uno), curva = curvaOrbita(par.pair, 96).map(([e, n]) => g.punto([base.este + e, base.norte + n]));
      const d = curva.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ');
      // Flecha del sentido de giro: la curva sigue el avance de la compañera en el tiempo.
      const [ax, ay] = curva[24], [bx, by] = curva[26];
      const angulo = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
      const deCanto = Math.abs(par.pair.i - 90) < 2 || Math.hypot(bx - ax, by - ay) < 0.2;
      return <g key={`o${par.otro}`} style={{ stroke: rgb(de(par.otro).color) }}>
        <path d={d} className="mapa-sistema-orbita" />
        {!deCanto && <path d="M-3 -2.4 L1 0 L-3 2.4" className="mapa-sistema-sentido" transform={`translate(${bx.toFixed(1)} ${by.toFixed(1)}) rotate(${angulo.toFixed(1)})`} />}
      </g>;
    })}
    {nivel.marcas.map(m => {
      const e = de(m.letra), [px, py] = g.punto([e.este, e.norte]);
      const grupo = m.letras.length > 1;
      const es = m.letras.some(l => de(l).star === actual);
      const etiqueta = grupo ? juntar(m.letras.map(l => rotuloCorto(de(l), primaria))) : rotuloCorto(e, primaria);
      const ocultas = m.letras.reduce((n, l) => n + de(l).ocultas.length, 0);
      const izquierda = px > ANCHO * 0.55;
      return <g key={`m${m.letra}`} ref={grupo ? undefined : el => { if (el) refs.current[`${nivel.id}:${m.letra}`] = { el, g, ancla: nivel.ancla, letra: m.letra }; }}
        transform={`translate(${px.toFixed(1)} ${py.toFixed(1)})`}>
        {grupo && <circle r="6.5" className="mapa-sistema-grupo" />}
        <circle r="5" fill={rgb(e.color)} opacity=".16" />
        <circle r="2.3" fill={rgb(e.color)} />
        {es && <circle r="4.6" fill="none" stroke="#fff" strokeOpacity=".85" strokeWidth=".8" />}
        <text x={izquierda ? -8 : 8} y="3" textAnchor={izquierda ? 'end' : 'start'} className={es ? 'mapa-sistema-nombre actual' : 'mapa-sistema-nombre'}>
          {etiqueta}{ocultas > 0 && <tspan className="mapa-sistema-oculta" dx="3">+{ocultas}</tspan>}
        </text>
      </g>;
    })}
    <g transform={`translate(10 ${g.H - 9})`} className="mapa-sistema-regla">
      <path d={`M0 -3 V0 H${largo.toFixed(1)} V-3`} />
      <text x={largo + 5} y="1">{regla.texto ? `${numero(regla.ua)} UA · ${regla.texto}` : `${numero(regla.ua)} UA`}</text>
    </g>
    {acelerado && <text x={compas ? 8 : ANCHO - 8} y={14} textAnchor={compas ? 'start' : 'end'} className="mapa-sistema-acelerado">{acelerado}</text>}
  </g>;
}

// Mapa del sistema tal como se ve desde la Tierra: norte arriba, este a la izquierda, a escala.
// Escalera de escalas: el sistema completo arriba y cada grupo ampliado debajo, de afuera hacia adentro.
export default function MapaSistema({ mapa, actual }) {
  const refs = useRef({});
  const niveles = useMemo(() => nivelesMapa(mapa), [mapa]);

  // Las compañeras con órbita giran desde su posición de hoy, cada par a su ritmo (una vuelta en
  // SEGUNDOS_POR_VUELTA). Las anchas no se mueven: no se conoce su órbita. Con movimiento reducido, todo quieto.
  useEffect(() => {
    if (!mapa?.pares.length) return;
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ano0 = anoActual(), t0 = performance.now();
    let pedido = 0;
    const dibujar = ahora => {
      const fijas = Object.fromEntries(Object.entries(mapa.porLetra).map(([l, e]) => [l, [e.este, e.norte]]));
      const vivas = { ...fijas };
      for (const par of mapa.pares) {
        const [e, n] = posicionEnOrbita(par.pair, ano0 + (ahora - t0) / 1000 / SEGUNDOS_POR_VUELTA * par.periodo);
        vivas[par.otro] = [vivas[par.uno][0] + e, vivas[par.uno][1] + n];
      }
      // Cada nivel sigue a su estrella ancla: un grupo ampliado no se sale de su recuadro mientras el de afuera gira.
      for (const { el, g, ancla, letra } of Object.values(refs.current)) {
        if (!el.isConnected) continue;
        const [px, py] = g.punto([vivas[letra][0] - vivas[ancla][0] + fijas[ancla][0], vivas[letra][1] - vivas[ancla][1] + fijas[ancla][1]]);
        el.setAttribute('transform', `translate(${px.toFixed(2)} ${py.toFixed(2)})`);
      }
      pedido = requestAnimationFrame(dibujar);
    };
    pedido = requestAnimationFrame(dibujar);
    return () => cancelAnimationFrame(pedido);
  }, [mapa]);

  if (!mapa || mapa.estrellas.length < 2) return null;
  const nombreNivel = n => juntar(n.marcas.flatMap(m => m.letras).map(l => rotuloCorto(mapa.porLetra[l], mapa.porLetra.A)));
  const etiqueta = `Mapa del sistema de ${mapa.porLetra.A.nombre} como se ve desde la Tierra, a escala, con el norte arriba.`;

  const filas = niveles.reduce((lista, n) => {
    const previa = lista.at(-1), inicio = previa ? previa.y + previa.H + 6 : 0;
    return [...lista, { n, y: inicio + (n.padre === null ? 0 : 16), H: encuadre(n, mapa, n.padre === null ? 150 : 95).H }];
  }, []);
  const altoTotal = filas.at(-1).y + filas.at(-1).H;
  return <svg className="mapa-sistema" viewBox={`0 0 ${ANCHO} ${altoTotal}`} role="img" aria-label={etiqueta}>
    {filas.map(({ n, y: fy }) => <g key={n.id}>
      {n.padre !== null && <text x="8" y={fy - 4} className="mapa-sistema-ampliado">↓ {nombreNivel(n)} · ampliado ×{numero(n.factor)}</text>}
      <Nivel nivel={n} mapa={mapa} actual={actual} refs={refs} y={fy} maxAlto={n.padre === null ? 150 : 95} compas={n.padre === null} recuadro={n.padre !== null} />
    </g>)}
  </svg>;
}
