import { useSyncExternalStore } from 'react';
import { AU_TO_PC, ECLIPTIC_UP, KM_TO_PC, LIGHT_DAY_PC } from './scale.js';
import { planetPosition } from './solarEphemeris.js';

// Trayectorias reales de las cuatro sondas que salen del sistema solar, de JPL Horizons
// (scripts/probes/build_probes.js). Cada sonda se coloca en la misma fecha que los planetas
// con una cola corta de cometa (ProbeComets.jsx); la ruta completa desde el lanzamiento
// (ProbeTrails.jsx) se enciende con «Rutas de sondas» en «Mostrar».
// El archivo viaja aparte del bundle (public/data/probes.json, ≈ 0,5 MB; ≈ 0,19 MB comprimido).
// Horizons publica las Voyager hasta el 01/01/2100 y las Pioneer hasta el 01/01/2050; aquí se
// guarda hasta el 31/12/2049 y después cada sonda queda en su último punto.
// Fecha de la escena: la de carga de la página, la misma que usan los planetas.
export const PROBE_DATE = new Date();

export const PROBES_SOURCE = 'https://ssd.jpl.nasa.gov/horizons/';

// Gris tenue para las cuatro, como en la referencia de NASA Eyes que eligió Sergio; al pasar
// el ratón sobre el nombre, la sonda se resalta (ProbeComets.jsx, App.css).
// `contactLost`: fin de la señal; desde entonces la posición es la trayectoria calculada.
export const PROBE_COLOR = '#6e7177';
// La cola de cometa cubre el último tramo de la trayectoria real, hasta donde la sonda estaba
// a este porcentaje de su distancia actual: no llega a entrar en el sistema solar. La cola
// mide el 51,75 % de la distancia (0,45 × 1,15: Sergio la pidió un 15 % más larga).
export const TAIL_START_FRACTION = 0.4825;
// Sonda bajo el ratón (código de Horizons o null); lo escriben las etiquetas y lo lee la escena.
export const probeHighlight = { code: null };
// Ruta marcada con un clic (ProbeTrails.jsx): queda resaltada, con sus planetas de entonces, sin
// mover la cámara. Otro clic en otra ruta la cambia; un clic en el vacío o Esc la quita.
export const probeMark = { code: null };
// Sonda elegida (por su nombre, el buscador o una etapa de la línea de tiempo); la escribe App.jsx.
export const probeFocus = { selected: null };
// Sonda en foco: la de la ruta marcada o la elegida. Con una en foco, las demás se esconden (rutas,
// colas, nombres y planetas de entonces).
export const focusedProbe = () => probeMark.code ?? probeFocus.selected;
export const probeHidden = code => focusedProbe() !== null && focusedProbe() !== code;
// Resaltar: la sonda bajo el ratón o la de la ruta marcada.
export const probeLit = code => probeHighlight.code === code || probeMark.code === code;
// Clic en una ruta: la marca. Clic fuera de una ruta: si era la marcada, la desmarca.
export function markRouteClick(code) { probeMark.code = code; }
export function markRouteMissed(code) { if (probeMark.code === code) probeMark.code = null; }
// Fecha bajo el ratón en el gráfico de la línea de tiempo (LineaTiempoSonda.jsx): la escena marca la
// sonda en ese punto de su ruta (SondaEntonces.jsx).
export const probeCursor = { code: null, jd: null };
export const PROBE_INFO = {
  [-31]: { name: 'Voyager 1', color: PROBE_COLOR, launch: '05/09/1977' },
  [-32]: { name: 'Voyager 2', color: PROBE_COLOR, launch: '20/08/1977' },
  [-23]: { name: 'Pioneer 10', color: PROBE_COLOR, launch: '03/03/1972', contactLost: '23/01/2003' },
  [-24]: { name: 'Pioneer 11', color: PROBE_COLOR, launch: '06/04/1973', contactLost: '30/09/1995' },
};

export const julianDay = date => date.getTime() / 86400000 + 2440587.5;

// Todas las muestras de una sonda en orden de tiempo: las de 8 días y, en cada paso por un
// planeta, las de los tramos densos de Horizons (`flybys`), que reemplazan a las más espaciadas en
// su intervalo; dentro del tramo cada hora manda el de 10 minutos. Se calcula una vez por sonda.
const sampleCache = new WeakMap();
const segmentTimes = segment => Array.from({ length: segment.xyz.length / 3 }, (_, i) => segment.startJd + i * segment.stepDays);
export function probeSamples(probe) {
  let samples = sampleCache.get(probe);
  if (samples) return samples;
  const segments = [probe, ...(probe.flybys ?? [])].map(segment => ({ segment, times: segmentTimes(segment) }));
  const finer = (jd, step) => segments.some(({ segment, times }) => segment.stepDays < step && jd >= times[0] && jd <= times.at(-1));
  const points = [];
  for (const { segment, times } of segments) times.forEach((jd, i) => {
    if (!finer(jd, segment.stepDays)) points.push([jd, segment.xyz[i * 3], segment.xyz[i * 3 + 1], segment.xyz[i * 3 + 2]]);
  });
  points.sort((a, b) => a[0] - b[0]);
  samples = { jd: Float64Array.from(points, point => point[0]), xyz: Float64Array.from(points.flatMap(point => point.slice(1))) };
  sampleCache.set(probe, samples);
  return samples;
}

// Índice de la última muestra con tiempo ≤ `jd` (0 si es anterior a la primera).
function sampleIndex(jd, times) {
  let low = 0, high = times.length - 1;
  if (jd >= times[high]) return high;
  while (high - low > 1) { const middle = (low + high) >> 1; if (times[middle] <= jd) low = middle; else high = middle; }
  return low;
}

// Posición heliocéntrica en UA (ICRF) en el día juliano `jd`, interpolada entre muestras.
// Fuera del intervalo publicado devuelve el extremo más cercano.
export function probePositionAu(probe, jd) {
  const { jd: times, xyz } = probeSamples(probe);
  const i = Math.min(sampleIndex(jd, times), times.length - 2);
  const t = Math.min(Math.max((jd - times[i]) / (times[i + 1] - times[i]), 0), 1);
  return [0, 1, 2].map(axis => xyz[i * 3 + axis] * (1 - t) + xyz[(i + 1) * 3 + axis] * t);
}

// Recorrido desde el lanzamiento hasta `jd`, en pc: todas las muestras anteriores y, al final,
// la posición exacta de la fecha.
export function probeTrailPc(probe, jd) {
  const { jd: times, xyz } = probeSamples(probe);
  const last = jd < times[0] ? -1 : sampleIndex(jd, times);
  // En doble precisión: de cerca, la escena dibuja la ruta respecto de un punto próximo a la cámara.
  const points = new Float64Array((last + 2) * 3);
  for (let k = 0; k < (last + 1) * 3; k++) points[k] = xyz[k] * AU_TO_PC;
  points.set(probePositionAu(probe, jd).map(value => value * AU_TO_PC), (last + 1) * 3);
  return points;
}

// Punto de la trayectoria real donde empieza la cola, en UA: la última muestra anterior a `jd`
// cuya distancia al Sol baja de TAIL_START_FRACTION de la actual.
export function probeTailAu(probe, jd) {
  const { jd: times, xyz } = probeSamples(probe);
  const head = probePositionAu(probe, jd), limit = Math.hypot(...head) * TAIL_START_FRACTION;
  let i = sampleIndex(jd, times);
  while (i > 0 && Math.hypot(xyz[i * 3], xyz[i * 3 + 1], xyz[i * 3 + 2]) > limit) i--;
  return [xyz[i * 3], xyz[i * 3 + 1], xyz[i * 3 + 2]];
}

// Un día luz en UA: c × 86.400 s con la UA de la IAU 2012 (173,1446 UA).
export const LIGHT_DAY_AU = LIGHT_DAY_PC / AU_TO_PC;
const lightDays = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
// Distancia a la Tierra en días luz para la etiqueta: «0,999 días luz»; si redondea a 1,000, «1 día luz».
export function lightDaysText(au) {
  const text = lightDays.format(au / LIGHT_DAY_AU);
  return text === '1,000' ? '1 día luz' : `${text} días luz`;
}

// Como cuerpo navegable, cada sonda se encuadra por su antena principal (Voyager 3,66 m, Pioneer
// 2,74 m; el radio que se declara es el de la nave sin brazos ni antenas de varilla). Se llega por el
// lado iluminado, a 60° del Sol, para que la antena no quede a contraluz.
export const PROBE_RADIUS_KM = { [-31]: 0.0025, [-32]: 0.0025, [-23]: 0.002, [-24]: 0.002 };
const ARRIVAL_FROM_SUN_DEG = 60;
const unit = v => { const length = Math.hypot(...v); return v.map(value => value / length); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export function probeArrival(positionAu) {
  const sunward = unit(positionAu.map(value => -value));
  const side = unit(cross(sunward, ECLIPTIC_UP));
  const angle = ARRIVAL_FROM_SUN_DEG * Math.PI / 180;
  return unit(sunward.map((value, i) => value * Math.cos(angle) + side[i] * Math.sin(angle) + ECLIPTIC_UP[i] * 0.25));
}

export function buildProbeBodies(probes, date = PROBE_DATE) {
  const jd = julianDay(date);
  // La Tierra en la misma fecha, en UA (las mismas efemérides que los planetas de la escena).
  const earth = planetPosition('Tierra', date).map(value => value / AU_TO_PC);
  return probes.filter(probe => PROBE_INFO[probe.code] && jd > probe.startJd).map(probe => {
    const au = probePositionAu(probe, jd);
    const earthAu = Math.hypot(au[0] - earth[0], au[1] - earth[1], au[2] - earth[2]);
    const radiusKm = PROBE_RADIUS_KM[probe.code];
    return { ...PROBE_INFO[probe.code], kind: 'probe', code: probe.code, optionValue: `sonda:${probe.code}`, data: probe, jd,
      positionAu: au, distanceAu: Math.hypot(...au), earthAu,
      // Dirección hacia la Tierra: hacia allí apunta la antena principal.
      towardEarth: unit(earth.map((value, i) => value - au[i])),
      position: au.map(value => value * AU_TO_PC), trail: probeTrailPc(probe, jd),
      tail: probeTailAu(probe, jd).map(value => value * AU_TO_PC),
      radiusKm, minDistancePc: radiusKm * 1.5 * KM_TO_PC, viewDirection: probeArrival(au), source: PROBES_SOURCE };
  });
}

let state = { status: 'idle', probes: [] };
const listeners = new Set();
const emit = next => { state = next; listeners.forEach(listener => listener()); };
function load() {
  if (state.status !== 'idle') return;
  state = { ...state, status: 'loading' };
  fetch('/data/probes.json').then(response => response.ok ? response.json() : Promise.reject(new Error(response.statusText)))
    .then(data => emit({ status: 'ready', probes: buildProbeBodies(data.probes) }))
    .catch(() => emit({ status: 'error', probes: [] }));
}
const subscribe = listener => { listeners.add(listener); load(); return () => listeners.delete(listener); };
export const useProbes = () => useSyncExternalStore(subscribe, () => state, () => state);
