import { useSyncExternalStore } from 'react';
import { KM_TO_PC } from './scale.js';
import { EPHEMERIS_DATE, planetPosition } from './solarEphemeris.js';
import { moonOffsetPc } from './moonEphemeris.js';

// Lunas de Júpiter y Saturno como cuerpos navegables. El archivo viaja aparte del bundle
// (public/data/moons.json, ≈ 0,7 MB; ≈ 0,25 MB comprimido) y se pide una sola vez; mientras tanto no hay lunas.
export const MOON_ELEMENTS_SOURCE = 'https://ssd.jpl.nasa.gov/sats/elem/';
export const MOON_PHYSICAL_SOURCE = 'https://ssd.jpl.nasa.gov/sats/phys_par/';
export const HORIZONS_SOURCE = 'https://ssd.jpl.nasa.gov/horizons/';
export const MOON_PLANETS = ['Júpiter', 'Saturno'];

export const SIZE_LABELS = {
  jpl: 'medio (JPL)',
  published: 'publicado',
  estimated: 'estimado por su brillo',
};

// Cada luna se coloca respecto de la posición de su planeta en la misma fecha que los planetas.
export function buildMoonBodies(moons, date = EPHEMERIS_DATE) {
  const centers = Object.fromEntries(MOON_PLANETS.map(planet => [planet, planetPosition(planet, date)]));
  return moons.map(moon => {
    const offsetPc = moonOffsetPc(moon, date);
    const radiusPc = moon.radiusKm * KM_TO_PC;
    return {
      kind: 'satellite', name: moon.name, optionValue: `luna:${moon.code}`, moon, planet: moon.planet,
      offsetPc, position: centers[moon.planet].map((value, i) => value + offsetPc[i]),
      radiusKm: moon.radiusKm, radiusLabel: SIZE_LABELS[moon.size], color: moon.color, source: MOON_ELEMENTS_SOURCE,
      // Las lunas de pocos cientos de metros son más pequeñas que el plano cercano de la cámara
      // (1e-14 pc ≈ 0,3 km): la cámara se detiene al menos a 0,5 km de su superficie.
      minDistancePc: Math.max(radiusPc * 1.02, radiusPc + 0.5 * KM_TO_PC),
    };
  // Por seguridad: una luna sin posición calculable no se dibuja ni se ofrece.
  }).filter(body => body.position.every(Number.isFinite));
}

let state = { status: 'idle', bodies: [] };
const listeners = new Set();
const emit = next => { state = next; listeners.forEach(listener => listener()); };
function load() {
  if (state.status !== 'idle') return;
  state = { ...state, status: 'loading' };
  fetch('/data/moons.json').then(response => response.ok ? response.json() : Promise.reject(new Error(response.statusText)))
    .then(data => emit({ status: 'ready', bodies: buildMoonBodies(data.moons) }))
    .catch(() => emit({ status: 'error', bodies: [] }));
}
const subscribe = listener => { listeners.add(listener); load(); return () => listeners.delete(listener); };
export const useMoons = () => useSyncExternalStore(subscribe, () => state, () => state);

// Planeta cuyas lunas se ofrecen en el selector: el enfocado o el de la luna enfocada.
export const moonHost = body => MOON_PLANETS.includes(body?.name) ? body.name : body?.kind === 'satellite' ? body.planet : null;

// ¿Tapa el planeta (esfera de radio R en el origen) a la luna vista desde la cámara?
export function hiddenByPlanet(cx, cy, cz, moon, radius) {
  const dx = moon[0] - cx, dy = moon[1] - cy, dz = moon[2] - cz;
  const length = Math.hypot(dx, dy, dz);
  const t = -(cx * dx + cy * dy + cz * dz) / length;
  if (t <= 0 || t >= length) return false;
  return Math.hypot(cx + dx / length * t, cy + dy / length * t, cz + dz / length * t) < radius;
}
