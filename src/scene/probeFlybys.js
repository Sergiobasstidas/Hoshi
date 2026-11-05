import { useSyncExternalStore } from 'react';
import { AU_TO_PC, KM_TO_PC } from './scale.js';
import { probeSamples as probeSamplesOf } from './probeTrajectories.js';

// Sobrevuelos de las sondas por Júpiter, Saturno, Urano y Neptuno. La curva alrededor de cada
// planeta viene de JPL Horizons con centro en el planeta (scripts/probes/fetch_flyby_curves.mjs):
// cada 10 minutos durante ± 3 días y cada minuto durante ± 12 horas del máximo acercamiento.
// Se dibuja respecto del planeta en el instante del máximo acercamiento (el «planeta de entonces»,
// con su radio real), así se ve a la distancia real y en el sentido en que la sonda lo rodeó.
// Con ella se agrega el detalle de cada minuto a la ruta heliocéntrica junto al planeta (composeRoute):
// una sola línea, la misma de lejos y de cerca.
// El archivo viaja aparte (public/data/probe-flybys.json) y se pide al encender «Rutas de sondas».
export const FLYBY_PLANETS = { jupiter: 'Júpiter', saturno: 'Saturno', urano: 'Urano', neptuno: 'Neptuno' };
// Las posiciones se guardan en decenas de km y como diferencias entre muestras seguidas.
export const FLYBY_UNIT_KM = 10;
// Arco de la órbita real del planeta (± 60 días, cada día), en centenas de km respecto del planeta
// de entonces.
export const ARC_UNIT_KM = 100;
export const flybyArcPc = flyby => Float32Array.from(decodeDeltas(flyby.arc.xyz), value => value * ARC_UNIT_KM * KM_TO_PC);

export const encodeDeltas = values => values.map((value, i) => i < 3 ? value : value - values[i - 3]);
export const decodeDeltas = deltas => {
  const values = new Float64Array(deltas.length);
  deltas.forEach((delta, i) => { values[i] = i < 3 ? delta : values[i - 3] + delta; });
  return values;
};

// Muestras ordenadas en el tiempo: días julianos y posición respecto del planeta en km.
export function flybySamples(flyby) {
  const km = decodeDeltas(flyby.xyz).map(value => value * FLYBY_UNIT_KM);
  // `minutes`: minutos desde la muestra anterior (la primera, 0).
  let elapsed = 0;
  const jd = Float64Array.from(flyby.minutes, step => flyby.startJd + (elapsed += step) / 1440);
  return { jd, km };
}

// Distancia mínima al centro del planeta, en km, y su instante.
export function closestApproach(flyby) {
  const { jd, km } = flybySamples(flyby);
  let best = 0;
  for (let i = 1; i < jd.length; i++) if (Math.hypot(km[i * 3], km[i * 3 + 1], km[i * 3 + 2]) < Math.hypot(km[best * 3], km[best * 3 + 1], km[best * 3 + 2])) best = i;
  return { jd: jd[best], km: Math.hypot(km[best * 3], km[best * 3 + 1], km[best * 3 + 2]) };
}

// Curva del sobrevuelo en pc, relativa al planeta de entonces (`planetPc`), sin otra corrección.
export function flybyCurvePc(flyby) {
  const { jd, km } = flybySamples(flyby);
  return { points: Float32Array.from(km, value => value * KM_TO_PC), planetPc: flyby.planetAu.map(value => value * AU_TO_PC),
    startJd: jd[0], endJd: jd.at(-1) };
}

let state = { status: 'idle', flybys: [] };
const listeners = new Set();
const emit = next => { state = next; listeners.forEach(listener => listener()); };
function load() {
  if (state.status !== 'idle') return;
  state = { ...state, status: 'loading' };
  fetch('/data/probe-flybys.json').then(response => response.ok ? response.json() : Promise.reject(new Error(response.statusText)))
    .then(data => emit({ status: 'ready', flybys: data.flybys }))
    .catch(() => emit({ status: 'error', flybys: [] }));
}
const subscribe = listener => { listeners.add(listener); load(); return () => listeners.delete(listener); };
export const useFlybys = () => useSyncExternalStore(subscribe, () => state, () => state);

// Ruta de una sonda con el detalle de sus sobrevuelos, toda en el marco heliocéntrico (pc, doble
// precisión): una sola línea, sin cambio de marco. Junto a cada planeta, entre las muestras densas de
// Horizons heliocéntricas (`probeData`, cada hora y cada 10 minutos en ± 6 días), la posición es la
// curva respecto del planeta (cada minuto cerca del máximo acercamiento) más el planeta P(t), que se
// interpola de esas mismas muestras: P(tᵢ) = sonda(tᵢ) − curva(tᵢ). En cada muestra densa la línea pasa
// exactamente por la posición de Horizons; entre ellas suma el detalle del giro.
// El planeta de entonces es P en el máximo acercamiento: la sonda queda a la distancia mínima publicada.
// `trail`: la ruta (pc) hasta la fecha de la escena; `times`: días julianos de sus muestras.
export function composeRoute(trail, times, probeData, flybys) {
  const { jd: dense, xyz } = probeSamplesOf(probeData);
  const count = trail.length / 3;
  const insertions = [], ghosts = [];
  for (const flyby of flybys) {
    const { jd, km } = flybySamples(flyby);
    const { jd: closest } = closestApproach(flyby);
    if (closest > times[count - 2]) continue;
    const rel = t => {
      let i = jd.findIndex(value => value >= t);
      if (i <= 0) i = 1;
      const f = (t - jd[i - 1]) / (jd[i] - jd[i - 1]);
      return [0, 1, 2].map(a => (km[(i - 1) * 3 + a] * (1 - f) + km[i * 3 + a] * f) * KM_TO_PC);
    };
    // Muestras densas heliocéntricas dentro de la curva (± 6 días) y el planeta en cada una.
    const anchors = [];
    for (let i = 0; i < dense.length; i++) {
      if (Math.abs(dense[i] - closest) > 6 || dense[i] < jd[0] || dense[i] > jd.at(-1)) continue;
      const r = rel(dense[i]);
      anchors.push({ t: dense[i], helio: [0, 1, 2].map(a => xyz[i * 3 + a] * AU_TO_PC), planet: [0, 1, 2].map(a => xyz[i * 3 + a] * AU_TO_PC - r[a]) });
    }
    if (anchors.length < 2) continue;
    const planetAt = t => {
      let i = anchors.findIndex(item => item.t >= t);
      if (i <= 0) i = 1;
      const f = (t - anchors[i - 1].t) / (anchors[i].t - anchors[i - 1].t);
      return [0, 1, 2].map(a => anchors[i - 1].planet[a] * (1 - f) + anchors[i].planet[a] * f);
    };
    const first = anchors[0].t, last = anchors.at(-1).t;
    // Las muestras de Horizons heliocéntricas, tal cual, y entre ellas las de la curva.
    const points = anchors.map(item => ({ t: item.t, p: item.helio }));
    for (let i = 0; i < jd.length; i++) {
      if (jd[i] <= first || jd[i] >= last || anchors.some(item => Math.abs(item.t - jd[i]) < 1e-6)) continue;
      const planet = planetAt(jd[i]);
      points.push({ t: jd[i], p: [0, 1, 2].map(a => planet[a] + km[i * 3 + a] * KM_TO_PC) });
    }
    points.sort((a, b) => a.t - b.t);
    insertions.push({ first, last, points });
    const planetPc = planetAt(closest);
    const r = rel(closest);
    // `planetAt` y `probeAt`: el planeta y la sonda en el día juliano t (pc), entre las muestras densas.
    ghosts.push({ flyby, planetPc, probePc: [0, 1, 2].map(a => planetPc[a] + r[a]), first, last, planetAt,
      probeAt: t => { const planet = planetAt(t), offset = rel(t); return [0, 1, 2].map(a => planet[a] + offset[a]); } });
  }
  insertions.sort((a, b) => a.first - b.first);
  const out = [];
  let k = 0;
  for (let i = 0; i < count; i++) {
    const t = i < count - 1 ? times[i] : Infinity;
    while (k < insertions.length && t > insertions[k].last) {
      for (const point of insertions[k].points) out.push(...point.p);
      k++;
    }
    if (k < insertions.length && t >= insertions[k].first) continue;
    out.push(trail[i * 3], trail[i * 3 + 1], trail[i * 3 + 2]);
  }
  return { points: Float64Array.from(out), ghosts };
}

// Destino del nombre del sobrevuelo: el planeta de entonces, visto de frente al plano de la curva
// (el sentido del giro se lee directo) y a la distancia que abarca el máximo acercamiento.
export function flybyBody(flyby, planet, planetPc, year) {
  const { jd, km } = flybySamples(flyby);
  const { jd: closest } = closestApproach(flyby);
  const i = Math.max(1, jd.findIndex(t => t >= closest));
  const r = [km[i * 3], km[i * 3 + 1], km[i * 3 + 2]];
  const v = [0, 1, 2].map(axis => km[i * 3 + axis] - km[(i - 1) * 3 + axis]);
  const normal = [r[1] * v[2] - r[2] * v[1], r[2] * v[0] - r[0] * v[2], r[0] * v[1] - r[1] * v[0]];
  const length = Math.hypot(...normal);
  return { kind: 'flyby', name: `${planet.name} · ${year}`, code: flyby.code, position: planetPc, radiusKm: planet.radiusKm,
    color: planet.color, companionViewDistance: Math.max(flyby.closestKm * 5, planet.radiusKm * 8) * KM_TO_PC,
    viewDirection: normal.map(value => value / length),
    // La sonda en el máximo acercamiento (sobre la curva del sobrevuelo), para dibujarla «entonces».
    probeAt: { jd: jd[i], position: planetPc.map((value, axis) => value + r[axis] * KM_TO_PC) } };
}

// Dos marcas de sentido sobre la curva, donde la sonda está al doble de la distancia mínima al
// entrar y al salir: posición (pc, respecto del planeta de entonces) y dirección de avance.
export function flybyArrows(flyby, points) {
  const { km } = flybySamples(flyby);
  const r = i => Math.hypot(km[i * 3], km[i * 3 + 1], km[i * 3 + 2]);
  const count = km.length / 3;
  let closest = 0;
  for (let i = 1; i < count; i++) if (r(i) < r(closest)) closest = i;
  const limit = r(closest) * 2;
  let before = closest, after = closest;
  while (before > 1 && r(before) < limit) before--;
  while (after < count - 2 && r(after) < limit) after++;
  const { jd } = flybySamples(flyby);
  return [before, after].map(i => ({ jd: jd[i],
    position: [points[i * 3], points[i * 3 + 1], points[i * 3 + 2]],
    direction: [0, 1, 2].map(axis => points[(i + 1) * 3 + axis] - points[(i - 1) * 3 + axis]),
  }));
}

// Versión simplificada de una línea para verla de lejos: conserva los extremos y los puntos
// separados al menos `spacing` del último conservado. Con miles de tramos de menos de un píxel
// uno encima de otro, la mezcla aditiva de la línea dibujaría un punto brillante.
export function thinIndices(points, spacing) {
  const kept = [0];
  const count = points.length / 3;
  for (let i = 1, last = 0; i < count; i++) {
    const gap = Math.hypot(points[i * 3] - points[last * 3], points[i * 3 + 1] - points[last * 3 + 1], points[i * 3 + 2] - points[last * 3 + 2]);
    if (gap >= spacing || i === count - 1) { kept.push(i); last = i; }
  }
  return kept;
}
export const pick = (values, indices) => values.constructor.from(indices.flatMap(i => [values[i * 3], values[i * 3 + 1], values[i * 3 + 2]]));
export const thinLine = (points, spacing) => pick(points, thinIndices(points, spacing));



// Cerca de un planeta de entonces se ve el arco de su órbita real y se atenúa la órbita actual del
// planeta (SolarSystem.jsx): del todo a menos de 0,08 UA, nada desde 0,2 UA.
export const ARC_AU = [0.08, 0.2];
// Planetas de entonces dibujados ahora, por nombre del planeta (los anota ProbeTrails.jsx).
export const flybyGhosts = new Map();
export function addFlybyGhost(name, position) {
  if (!flybyGhosts.has(name)) flybyGhosts.set(name, new Set());
  flybyGhosts.get(name).add(position);
  return () => flybyGhosts.get(name).delete(position);
}
