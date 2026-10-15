import { AU_TO_PC, KM_TO_PC, PLANETS, SUN_RADIUS_KM } from './scale.js';
import { ORBITAL_ELEMENTS_SOURCE, moonOffset, moonPosition, orbitalElements, planetPosition } from './solarEphemeris.js';
import { STAR_STOP_PC } from './starHeading.js';

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

export const SOLAR_BODIES = [
  { name: 'Sol', radiusKm: SUN_RADIUS_KM, position: [0, 0, 0], color: '#fff2c6', source: SUN_RADIUS_SOURCE },
  // Posición de la fecha de solarEphemeris.js; la excentricidad es la de esa misma fecha.
  ...PLANETS.map(planet => ({ ...planet, position: planetPosition(planet.name), eccentricity: orbitalElements(planet.name).e,
    source: PLANET_RADII_SOURCE, orbitSource: ORBITAL_ELEMENTS_SOURCE })),
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
  return { id: 'body', body, target: body.position, distance: Math.max(radiusPc * 6, body.companionViewDistance || 0), minDistance: radiusPc * 1.02, ...arrival(body) };
}
