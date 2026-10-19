import { KM_TO_PC } from './scale.js';

// Posición de las lunas de Júpiter y Saturno respecto de su planeta, en el marco ecuatorial
// J2000 (ICRF) del catálogo. Datos: public/data/moons.json, generado por
// scripts/moons/build_moons.js. Cada luna trae uno de dos modelos:
// - `sets` (lunas exteriores, a > 1,4 millones de km): elementos osculadores de JPL Horizons
//   cada 60 días, en ICRF; se usa el conjunto más cercano a la fecha y se propaga como órbita
//   de dos cuerpos (como mucho 30 días dentro del intervalo: < 0,1°).
// - elementos medios de JPL (lunas interiores): forma, plano y precesiones de
//   https://ssd.jpl.nasa.gov/sats/elem/, con la fase y el movimiento medio ajustados a Horizons.
const RAD = Math.PI / 180;
const OBLIQUITY = 23.43928 * RAD;
const UNIX_EPOCH_JD = 2440587.5;
export const julianDay = date => date.getTime() / 86400000 + UNIX_EPOCH_JD;

// Ejes X, Y, Z del plano de referencia expresados en ICRF.
const ICRF = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const ECLIPTIC = [[1, 0, 0], [0, Math.cos(OBLIQUITY), Math.sin(OBLIQUITY)], [0, -Math.sin(OBLIQUITY), Math.cos(OBLIQUITY)]];
// Plano de Laplace con polo (AR, Dec): X es su nodo ascendente sobre el ecuador ICRF.
export function laplaceBasis(poleRaDeg, poleDecDeg) {
  const ra = poleRaDeg * RAD, dec = poleDecDeg * RAD;
  const x = [-Math.sin(ra), Math.cos(ra), 0];
  const z = [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
  return [x, [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]], z];
}
const basisCache = new WeakMap();
function basisOf(moon) {
  if (moon.sets) return ICRF;
  if (moon.frame === 'ecliptic') return ECLIPTIC;
  if (!basisCache.has(moon)) basisCache.set(moon, laplaceBasis(moon.poleRa, moon.poleDec));
  return basisCache.get(moon);
}

function eccentricAnomaly(M, e) {
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 30; i++) {
    const step = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= step;
    if (Math.abs(step) < 1e-14) break;
  }
  return E;
}

// Elementos (a km, e, i, nodo, ω, M en grados) → posición en km en la base dada.
export function keplerPositionKm({ a, e, i, node, w, M }, basis = ICRF) {
  const E = eccentricAnomaly(M * RAD, e);
  const x = a * (Math.cos(E) - e), y = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(w * RAD), sw = Math.sin(w * RAD), cn = Math.cos(node * RAD), sn = Math.sin(node * RAD), ci = Math.cos(i * RAD), si = Math.sin(i * RAD);
  const u = x * cw - y * sw, v = x * sw + y * cw;
  const p = [u * cn - v * sn * ci, u * sn + v * cn * ci, v * si];
  return [0, 1, 2].map(k => p[0] * basis[0][k] + p[1] * basis[1][k] + p[2] * basis[2][k]);
}

// Conjunto de elementos osculadores más cercano: [jd, e, i, nodo, ω, n °/día, M, a].
export function nearestSet(sets, jd) {
  let best = sets[0];
  for (const set of sets) if (Math.abs(set[0] - jd) < Math.abs(best[0] - jd)) best = set;
  return best;
}

export function moonOffsetKm(moon, jd) {
  if (moon.sets) {
    const [epoch, e, i, node, w, n, M, a] = nearestSet(moon.sets, jd);
    return keplerPositionKm({ a, e, i, node, w, M: M + n * (jd - epoch) }, ICRF);
  }
  const dt = jd - moon.epoch;
  return keplerPositionKm({ a: moon.a, e: moon.e, i: moon.i, node: moon.node + moon.dnode * dt,
    w: moon.w + moon.dw * dt, M: moon.M + moon.n * dt }, basisOf(moon));
}

export const moonOffsetPc = (moon, date) => moonOffsetKm(moon, julianDay(date)).map(value => value * KM_TO_PC);

// Días entre la fecha y el conjunto de elementos usado (lunas exteriores) o la época del ajuste.
export function propagationDays(moon, date) {
  const jd = julianDay(date);
  return moon.sets ? Math.abs(nearestSet(moon.sets, jd)[0] - jd) : Math.abs(jd - moon.epoch);
}

// Periodo orbital en días: el del conjunto más cercano o el del movimiento medio ajustado.
export const orbitalPeriodDays = (moon, date) => 360 / Math.abs(moon.sets ? nearestSet(moon.sets, julianDay(date))[5] : moon.n);
export const semiMajorAxisKm = (moon, date) => moon.sets ? nearestSet(moon.sets, julianDay(date))[7] : moon.a;

// Polo de rotación de Saturno (IAU WGCCRE 2015, en J2000): normal del plano de los anillos.
// https://doi.org/10.1007/s10569-017-9805-5
export const SATURN_POLE_RA_DEG = 40.589, SATURN_POLE_DEC_DEG = 83.537;
export const SATURN_RING_BASIS = laplaceBasis(SATURN_POLE_RA_DEG, SATURN_POLE_DEC_DEG);

// Llegada a Júpiter y Saturno (pedido de Sergio, 15/10/2026, con una captura de NASA Eyes): desde
// el lado del Sol, 30° por encima del plano ecuatorial (donde orbitan las lunas regulares), por la
// cara iluminada (en Saturno, la de los anillos: en 2026 el Sol ilumina la cara sur) y a una distancia que encuadra Calisto o Titán. De canto las órbitas
// se confunden en una raya; por la cara en sombra el anillo B se ve oscuro. La vertical de la
// cámara es la de todas las vistas (normal de la eclíptica): con el polo del planeta como vertical,
// llegar a Saturno por su cara sur daba la vista vuelta 180° (Sergio, 15/10/2026).
// Polo de Júpiter: IAU WGCCRE 2015, J2000 (misma referencia que el de Saturno).
const PLANET_POLES = { 'Júpiter': [268.056595, 64.495303], Saturno: [SATURN_POLE_RA_DEG, SATURN_POLE_DEC_DEG] };
// 1,7 veces el semieje de Calisto (1.882.700 km) y de Titán (1.221.900 km), de JPL.
const ARRIVAL_FRAME_KM = { 'Júpiter': 1.7 * 1882700, Saturno: 1.7 * 1221900 };
const ARRIVAL_ELEVATION_DEG = 30;
const unit = v => { const length = Math.hypot(...v); return v.map(value => value / length); };
export function planetArrival(name, planetPosition) {
  if (!PLANET_POLES[name]) return null;
  const pole = laplaceBasis(...PLANET_POLES[name])[2], sunward = unit(planetPosition.map(value => -value));
  const elevation = sunward[0] * pole[0] + sunward[1] * pole[1] + sunward[2] * pole[2];
  const inPlane = unit(sunward.map((value, i) => value - elevation * pole[i]));
  const angle = ARRIVAL_ELEVATION_DEG * RAD, side = Math.sign(elevation) || 1;
  return { viewDirection: unit(inPlane.map((value, i) => value * Math.cos(angle) + side * pole[i] * Math.sin(angle))),
    companionViewDistance: ARRIVAL_FRAME_KM[name] * KM_TO_PC };
}
