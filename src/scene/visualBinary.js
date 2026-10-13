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

export function companionOrbitPc(elements, position, samples = 256) {
  return Array.from({ length: samples + 1 }, (_, i) =>
    equatorialVector(skyOffset(elements, i / samples * Math.PI * 2), position).map(v => v * AU_TO_PC));
}

export const apastronAu = elements => elements.a * (1 + elements.e);

// Une cada órbita con su registro del catálogo. La primaria conserva su posición de
// catálogo: sin masas por componente no se calcula el baricentro.
export function buildBinarySystems(orbits, starsById) {
  return Object.entries(orbits).flatMap(([id, orbit]) => {
    const star = starsById.get(Number(id));
    if (!star) return [];
    const position = [star.x, star.y, star.z];
    const offsetPc = companionOffsetPc(orbit, position);
    return [{ id: star.i, star, position, orbit, offsetPc, apastronPc: apastronAu(orbit) * AU_TO_PC,
      separationAu: Math.hypot(...offsetPc) / AU_TO_PC, companion: starsById.get(orbit.companionId) || null }];
  });
}
