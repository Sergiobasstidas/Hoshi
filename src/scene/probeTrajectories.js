import { useSyncExternalStore } from 'react';
import { AU_TO_PC } from './scale.js';

// Trayectorias reales de las cuatro sondas que salen del sistema solar, de JPL Horizons
// (scripts/probes/build_probes.js). Cada sonda se coloca en la misma fecha que los planetas
// con una cola corta de cometa (ProbeComets.jsx); la ruta completa desde el lanzamiento
// (ProbeTrails.jsx) queda guardada para un botón futuro.
// El archivo viaja aparte del bundle (public/data/probes.json, ≈ 0,34 MB; ≈ 0,14 MB comprimido).
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
export const PROBE_INFO = {
  [-31]: { name: 'Voyager 1', color: PROBE_COLOR, launch: '05/09/1977' },
  [-32]: { name: 'Voyager 2', color: PROBE_COLOR, launch: '20/08/1977' },
  [-23]: { name: 'Pioneer 10', color: PROBE_COLOR, launch: '03/03/1972', contactLost: '23/01/2003' },
  [-24]: { name: 'Pioneer 11', color: PROBE_COLOR, launch: '06/04/1973', contactLost: '30/09/1995' },
};

export const julianDay = date => date.getTime() / 86400000 + 2440587.5;

// Posición heliocéntrica en UA (ICRF) en el día juliano `jd`, interpolada entre muestras.
// Fuera del intervalo publicado devuelve el extremo más cercano.
export function probePositionAu(probe, jd) {
  const count = probe.xyz.length / 3;
  const f = Math.min(Math.max((jd - probe.startJd) / probe.stepDays, 0), count - 1);
  const i = Math.min(Math.floor(f), count - 2), t = f - i;
  return [0, 1, 2].map(axis => probe.xyz[i * 3 + axis] * (1 - t) + probe.xyz[(i + 1) * 3 + axis] * t);
}

// Recorrido desde el lanzamiento hasta `jd`, en pc: muestras cada `stepDays` y, al final,
// la posición exacta de la fecha. El paso fijo en el tiempo hace que la estela se apague
// según los años transcurridos.
export function probeTrailPc(probe, jd) {
  const last = Math.min(Math.floor((jd - probe.startJd) / probe.stepDays), probe.xyz.length / 3 - 1);
  const points = new Float32Array((last + 2) * 3);
  for (let i = 0; i <= last; i++) for (let axis = 0; axis < 3; axis++) points[i * 3 + axis] = probe.xyz[i * 3 + axis] * AU_TO_PC;
  points.set(probePositionAu(probe, jd).map(value => value * AU_TO_PC), (last + 1) * 3);
  return points;
}

// Punto de la trayectoria real donde empieza la cola, en UA: la última muestra anterior a `jd`
// cuya distancia al Sol baja de TAIL_START_FRACTION de la actual.
export function probeTailAu(probe, jd) {
  const head = probePositionAu(probe, jd), limit = Math.hypot(...head) * TAIL_START_FRACTION;
  let i = Math.min(Math.floor((jd - probe.startJd) / probe.stepDays), probe.xyz.length / 3 - 1);
  while (i > 0 && Math.hypot(probe.xyz[i * 3], probe.xyz[i * 3 + 1], probe.xyz[i * 3 + 2]) > limit) i--;
  return [probe.xyz[i * 3], probe.xyz[i * 3 + 1], probe.xyz[i * 3 + 2]];
}

export function buildProbeBodies(probes, date = PROBE_DATE) {
  const jd = julianDay(date);
  return probes.filter(probe => PROBE_INFO[probe.code] && jd > probe.startJd).map(probe => {
    const au = probePositionAu(probe, jd);
    return { ...PROBE_INFO[probe.code], code: probe.code, positionAu: au, distanceAu: Math.hypot(...au),
      position: au.map(value => value * AU_TO_PC), trail: probeTrailPc(probe, jd),
      tail: probeTailAu(probe, jd).map(value => value * AU_TO_PC) };
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
