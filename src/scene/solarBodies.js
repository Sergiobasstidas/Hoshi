import { AU_TO_PC, KM_TO_PC, PLANETS, SUN_RADIUS_KM, orbitalPosition } from './scale.js';
import { STAR_STOP_PC } from './starHeading.js';

// Radios volumétricos medios, consultados el 13/09/2026. Véase docs/SOLAR_RADII.md.
// Una esfera de este radio conserva el volumen del cuerpo, no su achatamiento.
export const PLANET_RADII_SOURCE = 'https://ssd.jpl.nasa.gov/planets/phys_par.html';
export const SUN_RADIUS_SOURCE = 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html';
// Separación media entre centros; fase y nodo ilustrativos, no efemérides actuales.
export const MOON_DISTANCE_KM = 384400;
const earth = PLANETS.find(planet => planet.name === 'Tierra');
const earthPosition = orbitalPosition(earth, earth.angle);
const lunarOffset = orbitalPosition({au: MOON_DISTANCE_KM * KM_TO_PC / AU_TO_PC, inclinationDeg:5.145, ascendingNodeDeg:0}, 0.7);
export const MOON = {name:'Luna', radiusKm:1737.4, color:'#c8c8c8',
  position:earthPosition.map((value,i)=>value+lunarOffset[i]),
  source:'https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html'};

export const SOLAR_BODIES = [
  { name: 'Sol', radiusKm: SUN_RADIUS_KM, position: [0, 0, 0], color: '#fff2c6', source: SUN_RADIUS_SOURCE },
  ...PLANETS.map(planet => ({ ...planet, position: orbitalPosition(planet, planet.angle), source: PLANET_RADII_SOURCE })),
  MOON,
];

export function bodyView(body) {
  if(body.kind==='star' && !body.radiusKm) return {id:'star',body,target:body.position,distance:Math.max(AU_TO_PC,body.companionViewDistance||0),minDistance:STAR_STOP_PC};
  if (body.kind === 'system') {
    return { id: 'system', body, target: body.position, distance: body.viewDistance, minDistance: body.minDistance, direction: body.viewDirection };
  }
  const radiusPc = body.radiusKm * KM_TO_PC;
  return { id: 'body', body, target: body.position, distance: Math.max(radiusPc * 6, body.companionViewDistance || 0), minDistance: radiusPc * 1.02 };
}
