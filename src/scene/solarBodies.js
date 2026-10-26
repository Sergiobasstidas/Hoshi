import { AU_TO_PC, ECLIPTIC_UP, KM_TO_PC, PLANETS, SUN_RADIUS_KM } from './scale.js';
import { ORBITAL_ELEMENTS_SOURCE, moonOffset, moonPosition, orbitalElements, planetPosition } from './solarEphemeris.js';
import { STAR_STOP_PC } from './starHeading.js';
import { planetArrival } from './moonEphemeris.js';

// Radios volumétricos medios, consultados el 13/09/2026. Véase docs/SOLAR_RADII.md.
// Una esfera de este radio conserva el volumen del cuerpo, no su achatamiento.
export const PLANET_RADII_SOURCE = 'https://ssd.jpl.nasa.gov/planets/phys_par.html';
export const SUN_RADIUS_SOURCE = 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html';
// Separación media entre centros, como referencia; la Luna se dibuja en su posición y a su
// distancia de la fecha de solarEphemeris.js (`distanceKm`).
export const MOON_DISTANCE_KM = 384400;
export const MOON = {name:'Luna', radiusKm:1737.4, color:'#c8c8c8',
  position:moonPosition(), distanceKm:Math.hypot(...moonOffset()) / KM_TO_PC,
  source:'https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html'};

// A la Tierra se llega casi a la altura de su órbita (8° sobre la eclíptica) y algo de lado
// respecto del Sol: vista desde muy arriba, la proyección exagera la inclinación de 23,4° de su
// eje (a 45° de altura parece de 34°). El lado iluminado queda hacia la cámara.
const EARTH_ARRIVAL_ELEVATION_DEG = 8, EARTH_ARRIVAL_SIDE_DEG = 35;
function earthArrival(position) {
  const unit = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
  const up = ECLIPTIC_UP, sunward = unit(position.map(value => -value));
  const height = sunward.reduce((sum, value, i) => sum + value * up[i], 0);
  const inPlane = unit(sunward.map((value, i) => value - height * up[i]));
  const side = [up[1] * inPlane[2] - up[2] * inPlane[1], up[2] * inPlane[0] - up[0] * inPlane[2], up[0] * inPlane[1] - up[1] * inPlane[0]];
  const turn = EARTH_ARRIVAL_SIDE_DEG * Math.PI / 180, lift = EARTH_ARRIVAL_ELEVATION_DEG * Math.PI / 180;
  const horizontal = inPlane.map((value, i) => value * Math.cos(turn) + side[i] * Math.sin(turn));
  return { viewDirection: horizontal.map((value, i) => value * Math.cos(lift) + up[i] * Math.sin(lift)) };
}

export const SOLAR_BODIES = [
  { name: 'Sol', radiusKm: SUN_RADIUS_KM, position: [0, 0, 0], color: '#fff2c6', source: SUN_RADIUS_SOURCE },
  // Posición de la fecha de solarEphemeris.js; la excentricidad es la de esa misma fecha.
  ...PLANETS.map(planet => ({ ...planet, position: planetPosition(planet.name), eccentricity: orbitalElements(planet.name).e,
    source: PLANET_RADII_SOURCE, orbitSource: ORBITAL_ELEMENTS_SOURCE,
    // A Júpiter y Saturno se llega desde arriba del plano de sus lunas (moonEphemeris.js).
    ...planetArrival(planet.name, planetPosition(planet.name)),
    ...(planet.name === 'Tierra' && earthArrival(planetPosition(planet.name))) })),
  MOON,
];

// Lado desde el que se llega, si el cuerpo lo declara (sistemas planetarios y sus planetas).
// El giro hacia ese lado termina a 0,6 del avance, antes de que se distingan las órbitas.
const arrival = body => body.viewDirection ? { direction: body.viewDirection, turnBy: 0.6, ...(body.viewUp && { up: body.viewUp }) } : {};
export function bodyView(body) {
  if(body.kind==='star' && !body.radiusKm) return {id:'star',body,target:body.position,distance:Math.max(AU_TO_PC,body.companionViewDistance||0),minDistance:STAR_STOP_PC,...arrival(body)};
  if (body.kind === 'system') {
    return { id: 'system', body, target: body.position, distance: body.viewDistance, minDistance: body.minDistance, direction: body.viewDirection };
  }
  const radiusPc = body.radiusKm * KM_TO_PC;
  return { id: 'body', body, target: body.position, distance: Math.max(radiusPc * 6, body.companionViewDistance || 0), minDistance: body.minDistancePc || radiusPc * 1.02, ...arrival(body) };
}
