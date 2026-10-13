import { AU_TO_PC } from './scale.js';
import { eccentricAnomaly } from './binaryOrbit.js';

// Órbitas relativas de binarias visuales (compañera respecto de la primaria) con
// elementos de ORB6. Véase docs/BINARIAS.md. Elementos: p en días, t en MJD,
// a en UA, ángulos en grados; w es la longitud del periastro de la órbita relativa.
export const BINARY_MODEL_DATE = '2026-09-18';
const radians = degrees => degrees * Math.PI / 180;
export const dateToMjd = date => Date.parse(`${date}T00:00:00Z`) / 86400000 + 40587;
// Año besseliano fraccionario, la convención de ORB6 para T0.
export const besselianYearToMjd = year => 15019.81352 + (year - 1900) * 365.242198781;

// Desplazamiento en el plano del cielo: norte, este y línea de visión (positiva al
// alejarse del Sol). Sin nodo ascendente identificado, el signo de la tercera
// componente es ambiguo: es un límite del dato, no del cálculo.
export function skyOffset(elements, E) {
  const x = elements.a * (Math.cos(E) - elements.e);
  const y = elements.a * Math.sqrt(1 - elements.e ** 2) * Math.sin(E);
  const w = radians(elements.w), node = radians(elements.node), inc = radians(elements.i);
  const u = x * Math.cos(w) - y * Math.sin(w), v = x * Math.sin(w) + y * Math.cos(w);
  return {
    north: u * Math.cos(node) - v * Math.sin(node) * Math.cos(inc),
    east: u * Math.sin(node) + v * Math.cos(node) * Math.cos(inc),
    away: v * Math.sin(inc),
  };
}

export function anomalyAt(elements, mjd) {
  return eccentricAnomaly(2 * Math.PI * (mjd - elements.t) / elements.p, elements.e);
}

// Ángulo de posición (grados, norte hacia el este) y separación en las unidades de a.
export function apparentPosition(elements, mjd) {
  const { north, east } = skyOffset(elements, anomalyAt(elements, mjd));
  return { theta: (Math.atan2(east, north) * 180 / Math.PI + 360) % 360, rho: Math.hypot(north, east) };
}

// Base norte/este/línea de visión en el marco ecuatorial del catálogo, tomada de la
// dirección Sol → estrella. No se rota ninguna coordenada del catálogo.
function equatorialVector({ north, east, away }, position) {
  const d = Math.hypot(...position);
  const ra = Math.atan2(position[1], position[0]), dec = Math.asin(position[2] / d);
  return [
    -east * Math.sin(ra) - north * Math.sin(dec) * Math.cos(ra) + away * Math.cos(dec) * Math.cos(ra),
    east * Math.cos(ra) - north * Math.sin(dec) * Math.sin(ra) + away * Math.cos(dec) * Math.sin(ra),
    north * Math.cos(dec) + away * Math.sin(dec),
  ];
}

// Posición de la compañera respecto de la primaria, en pc.
export function companionOffsetPc(elements, position, mjd = dateToMjd(BINARY_MODEL_DATE)) {
  return equatorialVector(skyOffset(elements, anomalyAt(elements, mjd)), position).map(v => v * AU_TO_PC);
}

// Órbitas de las dos estrellas de un par en torno a su centro de masas, expresadas
// respecto de la posición actual de la primaria. q = m2 / (m1 + m2). La primaria
// queda donde estaba: solo cambia la curva dibujada.
export function barycentricOrbitsPc(elements, position, massRatio, mjd = dateToMjd(BINARY_MODEL_DATE), samples = 256) {
  const now = companionOffsetPc(elements, position, mjd), relative = companionOrbitPc(elements, position, samples);
  const centre = now.map(v => v * massRatio);
  return { centre, primary: relative.map(p => p.map((v, i) => centre[i] - massRatio * v)),
    companion: relative.map(p => p.map((v, i) => centre[i] + (1 - massRatio) * v)) };
}

export function companionOrbitPc(elements, position, samples = 256) {
  return Array.from({ length: samples + 1 }, (_, i) =>
    equatorialVector(skyOffset(elements, i / samples * Math.PI * 2), position).map(v => v * AU_TO_PC));
}

export const apastronAu = elements => elements.a * (1 + elements.e);

// Color ilustrativo por clase espectral (secuencia de Harvard); «D» mayúscula es una
// enana blanca. Sin tipo espectral el marcador queda neutro: no se inventa un color.
const SPECTRAL_COLORS = { O: [155, 176, 255], B: [170, 191, 255], A: [202, 215, 255], F: [248, 247, 255],
  G: [255, 244, 234], K: [255, 210, 161], M: [255, 190, 127], D: [214, 224, 255], W: [170, 191, 255] };
export const NEUTRAL_COMPANION_COLOR = [223, 230, 255];
export function companionColor(spectral) {
  const match = /^(?:esd|sd|d|g|c)?([OBAFGKMDW])/.exec(spectral || '');
  return match ? SPECTRAL_COLORS[match[1]] : NEUTRAL_COMPANION_COLOR;
}
// Diámetro del marcador en píxeles según la magnitud absoluta V de la compañera.
// Indica brillo relativo; no es un radio estelar.
export function companionSizePx(magnitude, distancePc) {
  if (!Number.isFinite(magnitude) || !(distancePc > 0)) return 7;
  return Math.max(4, Math.min(14, 12 - 0.55 * (magnitude - 5 * Math.log10(distancePc / 10))));
}

// Par sin órbita: separación y ángulo de posición observados, proyectados en el plano
// del cielo. La profundidad relativa se desconoce y se deja en cero.
export function wideOffsetPc(pair, position) {
  const theta = radians(pair.theta);
  return equatorialVector({ north: pair.rho * Math.cos(theta), east: pair.rho * Math.sin(theta), away: 0 }, position).map(v => v * AU_TO_PC);
}

// Une cada sistema con su registro del catálogo y coloca sus componentes en cadena
// (Castor: Ab y B respecto de A, Bb respecto de B). La primaria conserva su posición de
// catálogo: sin masas por componente no se calcula el baricentro.
export function buildStarSystems(data, starsById) {
  return Object.entries(data).flatMap(([id, entry]) => {
    const star = starsById.get(Number(id));
    if (!star) return [];
    const position = [star.x, star.y, star.z], offsets = { A: [0, 0, 0] };
    const components = entry.comps.flatMap(pair => {
      const parent = offsets[pair.of];
      if (!parent) return [];
      const companion = starsById.get(pair.cid) || null;
      let relative = pair.k === 'o' ? companionOffsetPc(pair, position) : wideOffsetPc(pair, position);
      // Un par ancho cuya compañera ya es un registro del catálogo usa esa posición.
      if (companion && pair.k === 'w') relative = [companion.x - position[0] - parent[0], companion.y - position[1] - parent[1], companion.z - position[2] - parent[2]];
      const offsetPc = parent.map((v, i) => v + relative[i]);
      // Con órbita, el registro del catálogo se coloca sobre ella en la fecha del modelo:
      // su posición de catálogo corresponde a otra época.
      if (companion && pair.k === 'o') [companion.x, companion.y, companion.z] = offsetPc.map((v, i) => v + position[i]);
      offsets[pair.n] = offsetPc;
      const separationAu = Math.hypot(...relative) / AU_TO_PC;
      // Con masas estimadas (MSC) las dos estrellas giran en torno a su centro de masas.
      const massRatio = pair.k === 'o' && pair.m1 > 0 && pair.m2 > 0 ? pair.m2 / (pair.m1 + pair.m2) : null;
      return [{ name: pair.n, pair, companion, parentOffsetPc: parent, offsetPc, separationAu, massRatio,
        scalePc: (pair.k === 'o' ? apastronAu(pair) : separationAu) * AU_TO_PC,
        color: companion?.rgb || companionColor(pair.sp), sizePx: companionSizePx(pair.v, star.d),
        label: `${star.n || entry.wds} ${pair.n}` }];
    });
    if (!components.length) return [];
    // Encuadre de llegada: lo más ancho del sistema que siga siendo un conjunto compacto.
    const framed = components.filter(c => Math.hypot(...c.offsetPc) + c.scalePc < FRAME_LIMIT_AU * AU_TO_PC);
    return [{ id: star.i, star, position, wds: entry.wds, components, hidden: entry.hidden || [],
      rangePc: Math.max(...components.map(c => c.scalePc)),
      framePc: framed.length ? Math.max(...framed.map(c => Math.hypot(...c.parentOffsetPc) + c.scalePc)) : 0 }];
  });
}
export const FRAME_LIMIT_AU = 2500;
