// Solar System Scope / INOVE, CC BY 4.0. Original, unmodified equirectangular maps.
// These are appearance maps, not elevation or time-specific observations.
export const PLANET_TEXTURE_SOURCE = 'https://www.solarsystemscope.com/textures/';
export const PLANET_TEXTURE_LICENSE = 'https://creativecommons.org/licenses/by/4.0/';
const ROOT = '/textures/solar-system-scope/';
export const PLANET_TEXTURES = {
  Luna: { url: `${ROOT}2k_moon.jpg`, description: 'Mapa de superficie lunar' },
  Mercurio: { url: `${ROOT}2k_mercury.jpg`, description: 'Mapa de superficie' },
  Venus: { url: `${ROOT}4k_venus_atmosphere.jpg`, description: 'Cubierta nubosa' },
  Tierra: { url: `${ROOT}2k_earth_daymap.jpg`, description: 'Mapa diurno de superficie' },
};
