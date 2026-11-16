import { useEffect, useRef } from 'react';
import { eccentricAnomaly } from './scene/binaryOrbit';
import { anoActual } from './scene/orbitasPar';
import { redondeo } from './scene/gruposSistema';

const ANCHO = 300, ALTO = 90, CY = 40, CX = 46, RADIO_PAR = 26, X_LEJANA = 268;
const SEGUNDOS_POR_VUELTA = 16;
const rgb = c => `rgb(${c.join(',')})`;
const radioMasa = m => (m > 0 ? 2 + 2.2 * Math.cbrt(m) : 3);

// Esquema del sistema: la pareja con órbita girando en torno a su centro de masa y, a la derecha,
// las compañeras lejanas tras un corte de escala con cuántas veces más lejos están.
export default function EsquemaSistema({ par, lejanas, actual }) {
  const unoRef = useRef(), otroRef = useRef();
  const q = par?.masas ? par.masas[1] / (par.masas[0] + par.masas[1]) : 0;
  // Escala del esquema: el punto más lejano de las dos estrellas al centro de masa cabe en RADIO_PAR.
  const escala = par ? RADIO_PAR / (par.a * (1 + par.e) * Math.max(q, 1 - q)) : 0;
  const elipse = par ? (() => {
    const b = par.a * Math.sqrt(1 - par.e ** 2);
    return f => ({ cx: CX - par.a * par.e * f * escala, rx: par.a * Math.abs(f) * escala, ry: b * Math.abs(f) * escala });
  })() : null;

  useEffect(() => {
    if (!par?.periodo || !par.a) return;
    const quieto = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ano0 = anoActual(), t0 = performance.now();
    const periastro = 2000 + (par.pair.t - 51544.5) / 365.25;
    let pedido = 0;
    const dibujar = ahora => {
      const t = ano0 + (quieto ? 0 : (ahora - t0) / 1000 / SEGUNDOS_POR_VUELTA * par.periodo);
      const E = eccentricAnomaly(2 * Math.PI * (t - periastro) / par.periodo, par.e);
      const x = par.a * (Math.cos(E) - par.e) * escala, y = par.a * Math.sqrt(1 - par.e ** 2) * Math.sin(E) * escala;
      unoRef.current?.setAttribute('transform', `translate(${CX - q * x} ${CY + q * y})`);
      otroRef.current?.setAttribute('transform', `translate(${CX + (1 - q) * x} ${CY - (1 - q) * y})`);
      if (!quieto) pedido = requestAnimationFrame(dibujar);
    };
    dibujar(performance.now());
    return () => cancelAnimationFrame(pedido);
  }, [par, q, escala]);

  const estrella = (miembro, radio, ref, x = 0, y = 0) => <g ref={ref} transform={`translate(${x} ${y})`}>
    <circle r={radio * 2.4} fill={rgb(miembro.color)} opacity=".16" />
    <circle r={radio} fill={rgb(miembro.color)} />
    {miembro.star === actual && <circle r={radio + 2.6} fill="none" stroke="#fff" strokeOpacity=".85" strokeWidth=".9" />}
  </g>;

  const ys = lejanas.length === 1 ? [CY] : lejanas.map((_, i) => 16 + i * (48 / (lejanas.length - 1)));
  const titulo = [par && `${par.uno.nombre} y ${par.otro.nombre} giran una en torno a la otra`,
    ...lejanas.map(l => `${l.miembro.nombre} viaja con ellas mucho más lejos`)].filter(Boolean).join('; ');
  const inicioLinea = par ? CX + RADIO_PAR + 8 : CX + 10;
  return <svg className="esquema-sistema" viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img" aria-label={titulo}>
    {par && elipse && <>
      {[-q, 1 - q].map((f, i) => Math.abs(f) > 1e-3 && <ellipse key={i} {...elipse(f)} cy={CY} fill="none" stroke="#ffffff" strokeOpacity=".16" strokeWidth=".8" />)}
      <circle cx={CX} cy={CY} r="1.1" fill="#8fd3ff" opacity=".7" />
      {estrella(par.uno, radioMasa(par.masas?.[0]), unoRef, CX, CY)}
      {estrella(par.otro, radioMasa(par.masas?.[1]), otroRef, CX + RADIO_PAR, CY)}
    </>}
    {!par && lejanas[0] && estrella(lejanas[0].de, 4, null, CX, CY)}
    {lejanas.map((l, i) => {
      const y = ys[i], corte = (inicioLinea + X_LEJANA) / 2;
      return <g key={l.miembro.nombre}>
        <path d={`M${inicioLinea} ${CY} C${corte - 30} ${CY} ${corte - 30} ${y} ${corte - 6} ${y} M${corte + 6} ${y} L${X_LEJANA - 9} ${y}`}
          fill="none" stroke="#ffffff" strokeOpacity=".28" strokeWidth=".8" strokeDasharray="2 3" />
        <path d={`M${corte - 4} ${y + 4} l4 -8 M${corte + 1} ${y + 4} l4 -8`} stroke="#ffffff" strokeOpacity=".5" strokeWidth=".9" />
        {(l.veces || l.rho) && <text x={corte} y={y - 7} textAnchor="middle" className="esquema-sistema-dato">
          {l.veces ? `≈ ${redondeo(l.veces).toLocaleString('es-CL')}× más lejos` : `${redondeo(l.rho).toLocaleString('es-CL')} UA`}
        </text>}
        {estrella(l.miembro, 3, null, X_LEJANA, y)}
      </g>;
    })}
    {par && <text x={4} y={ALTO - 4} className="esquema-sistema-nombre">{par.uno.nombre} y {par.otro.nombre}</text>}
    {!par && lejanas[0] && <text x={4} y={ALTO - 4} className="esquema-sistema-nombre">{lejanas[0].de.nombre}</text>}
    {lejanas.length === 1 && <text x={X_LEJANA + 6} y={ALTO - 4} textAnchor="end" className="esquema-sistema-nombre">{lejanas[0].miembro.nombre}</text>}
  </svg>;
}
