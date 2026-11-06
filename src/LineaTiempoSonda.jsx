import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Dato } from './FichaLateral';
import { PLANETS } from './scene/scale';
import { escapeSpeed, stageJd, stageText, timeAxis } from './scene/probeStages';
import { probeCursor } from './scene/probeTrajectories';
import { WINDOW_DAYS, flybyKey, stopFlyby, useFlybyPlayback } from './scene/flybyPlayback';
import './lineaTiempo.css';

// Línea de tiempo de la sonda elegida, abajo: un punto por etapa (lanzamiento, cada sobrevuelo en el
// color de su planeta, heliopausa o fin del contacto y hoy), con el nombre arriba y el año abajo. Sobre
// ella, la rapidez respecto del Sol desde el lanzamiento y, en trazos, la necesaria para escapar del
// Sol a esa distancia, con el mismo eje: cada salto queda sobre el punto de su planeta. El eje se
// comprime por tramos (probeStages.js) y los tramos comprimidos llevan un corte. Un clic en una etapa
// lleva la cámara allí (`onIr`) y abre su ficha encima del punto. Datos: JPL Horizons.
const CHART_HEIGHT = 112, AXIS_Y = 176, HEIGHT = 204;
const COLORS = { lanzamiento: '#8dc9ef', heliopausa: '#c9a5e8', 'fin del contacto': '#7f8b9b', hoy: '#e6e9ee' };
const colorOf = stage => stage.planet ? PLANETS.find(planet => planet.name === stage.planet)?.color : COLORS[stage.kind];
const nameOf = stage => stage.planet ?? { lanzamiento: 'Lanzamiento', heliopausa: 'Heliopausa', 'fin del contacto': 'Fin del contacto', hoy: 'Hoy' }[stage.kind];
const number = (value, digits = 1) => value.toLocaleString('es-CL', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const integer = value => Math.round(value).toLocaleString('es-CL');
const dateOf = stage => {
  const text = stage.utc ?? stage.date;
  const date = new Date(text.length === 10 ? `${text}T12:00:00Z` : text);
  const day = date.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return text.length === 10 ? day : `${day}, ${date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' })} UTC`;
};
// Fecha y hora UTC de la animación y su distancia en el tiempo al máximo acercamiento.
const momentoDe = (jd, closest) => {
  const date = new Date((jd - 2440587.5) * 86400000);
  const hours = (jd - closest) * 24;
  const offset = Math.abs(hours) < 1 ? 'máximo acercamiento' : `${hours < 0 ? '−' : '+'}${Math.abs(hours) >= 48 ? `${number(Math.abs(hours) / 24)} días` : `${Math.round(Math.abs(hours))} h`}`;
  return `${date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}, ${date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' })} UTC · ${offset}`;
};
const yearOf = stage => new Date((stageJd(stage) - 2440587.5) * 86400000).getUTCFullYear();

// Contenido de la ficha lateral de una etapa (FichaLateral en App.jsx): nombre de la sonda, la etapa
// con su fecha, el texto y los datos, y ‹ › para recorrer las etapas, a la par con la línea.
export function FichaEtapa({ probe, stages, index, onElegir, onReproducir }) {
  const stage = stages[index], code = probe.code;
  // Animación del paso por el planeta (flybyPlayback.js); se detiene al cambiar de etapa o cerrar.
  const animacion = useFlybyPlayback();
  const clave = stage.planet ? flybyKey(code, stage.planet) : null;
  const animando = clave && animacion.key === clave && animacion.t !== null;
  useEffect(() => () => stopFlyby(), [clave]);
  const planet = stage.planet && PLANETS.find(item => item.name === stage.planet);
  return <div className="ficha-etapa" style={{ '--color': colorOf(stage) }}>
    <h2 className="marca-hoshi">{probe.name}</h2>
    <p className="ficha-estrella-tipo ficha-etapa-nombre"><span>{stage.planet ? `${stage.planet} · ${yearOf(stage)}` : nameOf(stage)}</span>
      <span className="ficha-etapa-pasos">
        <button aria-label="Etapa anterior" disabled={index === 0} onClick={() => onElegir(index - 1)}>‹</button>
        <button aria-label="Etapa siguiente" disabled={index === stages.length - 1} onClick={() => onElegir(index + 1)}>›</button>
      </span></p>
    <p className="ficha-etapa-fecha">{dateOf(stage)}</p>
    {clave && <p className="ficha-etapa-animacion">
      <button onClick={() => onReproducir(stage)} aria-label={animando && animacion.playing ? 'Pausar' : 'Ver el paso'}>
        {animando && animacion.playing ? '❚❚' : '▶'}</button>
      <span>{animando ? momentoDe(animacion.t, stage.closestJd) : `Ver el paso: ${WINDOW_DAYS} días antes y después, con el planeta en movimiento`}</span>
    </p>}
    {stageText(code, stage) && <p className="ficha-estrella-relato">{stageText(code, stage)}</p>}
    <dl>
      {stage.kind === 'lanzamiento' && <>
        <Dato etiqueta="Lugar" valor={stage.place} />
        <Dato etiqueta="Cohete" valor={stage.rocket} />
      </>}
      {stage.kind === 'sobrevuelo' && <>
        <Dato etiqueta="Máximo acercamiento" valor={`${integer(stage.closestKm)} km`} secundario={`del centro · ${number(stage.closestKm / planet.radiusKm)} radios de ${stage.planet}`} />
        <Dato etiqueta="Respecto del Sol" valor={`${number(stage.sunSpeedBefore)} → ${number(stage.sunSpeedAfter)} km/s`} secundario="10 días antes y 10 días después" />
        <Dato etiqueta={stage.gain >= 0 ? 'Ganó' : 'Perdió'} valor={`${number(Math.abs(stage.gain))} km/s`} secundario="por la asistencia gravitatoria" />
        <Dato etiqueta={`Respecto de ${stage.planet}`} valor={`${number(stage.planetSpeed)} km/s`} secundario={`en el máximo acercamiento · llegó a ${number(stage.approachSpeed)} km/s`} />
        <Dato etiqueta="Desvío de la trayectoria" valor={`${integer(stage.deflectionDeg)}°`} />
        <Dato etiqueta="Distancia al Sol" valor={`${number(stage.sunAu, 2)} UA`} />
      </>}
      {stage.kind === 'heliopausa' && <>
        <Dato etiqueta="Distancia al Sol" valor={`${number(stage.au)} UA`} secundario={<a href={stage.source} target="_blank" rel="noreferrer">valor publicado</a>} />
      </>}
      {stage.kind === 'hoy' && <>
        <Dato etiqueta="Distancia al Sol" valor={`${number(stage.au)} UA`} />
        <Dato etiqueta="Respecto del Sol" valor={`${number(stage.sunSpeed)} km/s`} secundario={`para escapar del Sol aquí bastan ${number(stage.escapeSpeed)} km/s`} />
        <Dato etiqueta="Distancia a la Tierra" valor={`${number(stage.earthLightDays, 3)} días luz`} secundario={`al ${dateOf(stage)}`} />
      </>}
    </dl>
    <p className="ficha-estrella-fuente">Datos: JPL Horizons{stage.kind === 'heliopausa' ? ' · cruce de la heliopausa: Burlaga et al. (2019)' : ''}.</p>
  </div>;
}

// `selected` (índice de la etapa elegida o null) lo guarda App.jsx, que muestra su ficha lateral.
export default function LineaTiempoSonda({ probe, data, onIr, onCerrar, selected, onSelect }) {
  const root = useRef();
  const [width, setWidth] = useState(560);
  const [cursor, setCursor] = useState(null);
  const [bounds, setBounds] = useState(null);
  const compact = width < 700;
  // En pantallas angostas la línea se desplaza a lo ancho con un ancho mínimo.
  const inner = Math.max(width, 720);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  // En el computador ocupa el espacio libre entre los visores de distancia y velocidad y «Modo de
  // visión»; se mide en pantalla porque esos controles cambian de tamaño con el zoom de la interfaz.
  useLayoutEffect(() => {
    const measure = () => {
      const parent = root.current?.parentElement?.getBoundingClientRect();
      const dials = document.querySelector('.visores-vuelo')?.getBoundingClientRect();
      const modes = document.querySelector('.selector-brillo')?.getBoundingClientRect();
      // Con la ficha lateral abierta, la línea empieza a su derecha.
      const panel = document.querySelector('.ficha-estrella-contenido')?.getBoundingClientRect();
      if (!parent || !dials || !modes || window.innerWidth <= 700) { setBounds(null); return; }
      const left = Math.max(dials.right, panel ? panel.right : 0);
      setBounds({ left: left - parent.left + 18, right: parent.right - modes.left + 18 });
    };
    measure();
    // La ficha lateral aparece, cambia de ancho o se cierra: se vuelve a medir.
    const observer = new ResizeObserver(measure);
    const watch = () => { observer.disconnect(); const panel = document.querySelector('.ficha-estrella'); if (panel) observer.observe(panel); };
    const mutations = new MutationObserver(() => { watch(); measure(); });
    const overlay = root.current?.parentElement;
    if (overlay) mutations.observe(overlay, { childList: true });
    watch();
    window.addEventListener('resize', measure);
    return () => { window.removeEventListener('resize', measure); observer.disconnect(); mutations.disconnect(); };
  }, []);
  useEffect(() => () => { probeCursor.jd = null; }, []);
  useEffect(() => {
    // Esc lo cierra todo (App.jsx suelta la sonda); aquí solo se quita la etapa.
    const onKey = event => { if (event.key === 'Escape' && selected !== null) onSelect(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, onCerrar, onSelect]);

  const stages = data.stages;
  const axis = useMemo(() => timeAxis(stages), [stages]);
  const pad = 54, span = inner - pad * 2;
  const x = position => pad + position * span;
  const chart = useMemo(() => {
    const { startJd, stepDays, speed, au } = data.series;
    const max = Math.max(...speed) * 1.05;
    const y = value => CHART_HEIGHT - value / max * (CHART_HEIGHT - 20);
    const points = (values) => values.map((value, i) => `${x(axis.at(startJd + i * stepDays)).toFixed(1)},${y(value).toFixed(1)}`).join(' ');
    const escape = au.map(value => Math.min(escapeSpeed(Math.max(value, 0.3)), max));
    const ticks = [10, 20, 30, 40].filter(value => value < max).filter((_, i, list) => list.length <= 3 || i % 2 === 1);
    return { speed: points(speed), escape: points(escape), ticks, y, max };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- x depende de `inner`.
  }, [data, axis, inner]);

  const elegir = index => {
    const next = Math.max(0, Math.min(stages.length - 1, index));
    onSelect(next);
    onIr(stages[next]);
  };
  const speedAt = position => {
    const { startJd, stepDays, speed, au } = data.series;
    let best = 0;
    for (let i = 0; i < speed.length; i++) if (Math.abs(axis.at(startJd + i * stepDays) - position) < Math.abs(axis.at(startJd + best * stepDays) - position)) best = i;
    return { x: x(axis.at(startJd + best * stepDays)), speed: speed[best], escape: escapeSpeed(Math.max(au[best], 0.3)), jd: startJd + best * stepDays };
  };

  return <section ref={root} className={`linea-tiempo${compact ? ' compacta' : ''}`} aria-label={`Etapas de ${probe.name}`}
    style={bounds ? { left: bounds.left, right: bounds.right } : undefined}>
    <div className="linea-cabecera">
      <span>{probe.name}</span>
      <button className="linea-cerrar" aria-label="Cerrar línea de tiempo" onClick={onCerrar}>×</button>
    </div>
    <div className="linea-desplazable">
      {/* Todo el alto del visor (gráfico, nombres, puntos y años) mueve la sonda por su ruta. */}
      <div className="linea-lienzo" style={{ width: inner }}
        onPointerMove={event => {
          const offset = event.clientX - event.currentTarget.getBoundingClientRect().left;
          if (offset < pad || offset > inner - pad) { setCursor(null); probeCursor.jd = null; return; }
          const point = speedAt((offset - pad) / span);
          setCursor(point);
          Object.assign(probeCursor, { code: probe.code, jd: point.jd });
        }}
        onPointerLeave={() => { setCursor(null); probeCursor.jd = null; }}>
        <svg width={inner} height={HEIGHT} aria-hidden="true">
          <text className="linea-grafico-titulo" x={pad} y={10}>Velocidad respecto del Sol</text>
          {chart.ticks.map(value => <g key={value}>
            <line className="linea-marca" x1={pad} x2={inner - pad} y1={chart.y(value)} y2={chart.y(value)} />
            <text className="linea-marca-texto" x={inner - pad + 6} y={chart.y(value) + 4}>{value} km/s</text>
          </g>)}
          <polyline className="linea-escape" points={chart.escape} />
          <polyline className="linea-rapidez" points={chart.speed} />
          {cursor && <g>
            <line className="linea-cursor" x1={cursor.x} x2={cursor.x} y1={16} y2={AXIS_Y} />
            <text className="linea-cursor-texto" x={Math.min(cursor.x + 8, inner - 230)} y={26}>
              {`${new Date((cursor.jd - 2440587.5) * 86400000).getUTCFullYear()} · ${number(cursor.speed)} km/s · escape ${number(cursor.escape)}`}</text>
          </g>}
          <line className="linea-eje" x1={pad} x2={inner - pad} y1={AXIS_Y} y2={AXIS_Y} />
          {axis.breaks.map(position => <text key={position} className="linea-corte" x={x(position)} y={AXIS_Y + 5} textAnchor="middle">≈</text>)}
          {selected !== null && stages[selected].kind === 'sobrevuelo' && <circle className="linea-punto-grafico" cx={x(axis.positions[selected])}
            cy={chart.y(Math.min(stages[selected].sunSpeedAfter, chart.max))} r={4.5} style={{ fill: colorOf(stages[selected]) }} />}
        </svg>
        {stages.map((stage, i) => <button key={i} className={`linea-etapa${selected === i ? ' elegida' : ''}${i % 2 ? ' alterna' : ''}`}
          style={{ left: x(axis.positions[i]), top: AXIS_Y, '--color': colorOf(stage) }}
          onClick={() => (selected === i ? onSelect(null) : elegir(i))} title={`${nameOf(stage)} · ${dateOf(stage)}`}>
          <span className="linea-etapa-nombre">{nameOf(stage)}</span>
          <span className="linea-etapa-anio">{yearOf(stage)}</span>
        </button>)}
      </div>
    </div>
    <button className="linea-flecha anterior" aria-label="Etapa anterior" onClick={() => elegir(selected === null ? stages.length - 1 : selected - 1)}>‹</button>
    <button className="linea-flecha siguiente" aria-label="Etapa siguiente" onClick={() => elegir(selected === null ? 0 : selected + 1)}>›</button>
  </section>;
}
