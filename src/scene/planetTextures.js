// Solar System Scope / INOVE, CC BY 4.0. Mapas equirectangulares originales sin modificar.
// Son mapas de apariencia, no de elevación ni observaciones de una fecha concreta.
export const PLANET_TEXTURE_SOURCE = 'https://www.solarsystemscope.com/textures/';
export const PLANET_TEXTURE_LICENSE = 'https://creativecommons.org/licenses/by/4.0/';
const ROOT = '/textures/solar-system-scope/';
export const PLANET_TEXTURES = {
  Luna: { url: `${ROOT}2k_moon.jpg`, description: 'Mapa de superficie lunar' },
  Mercurio: { url: `${ROOT}2k_mercury.jpg`, description: 'Mapa de superficie' },
  Venus: { url: `${ROOT}4k_venus_atmosphere.jpg`, description: 'Cubierta nubosa' },
  Tierra: { url: `${ROOT}2k_earth_daymap.jpg`, description: 'Mapa diurno de superficie' },
};
