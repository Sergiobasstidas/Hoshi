// scripts/catalog/catalog_patches.js
// Parches que scripts/process_stars.js aplica al catálogo base sin modificar AT-HYG:
// distancias corregidas con Gaia DR3 y anfitrionas de exoplanetas añadidas.
// Los generan build_distance_corrections.js y build_added_hosts.js en data/catalog/.

import fs from 'node:fs';

const CORRECTIONS_JSON = './data/catalog/distance_corrections.json';
const ADDED_HOSTS_JSON = './data/catalog/added_hosts.json';

// Posición y magnitud absoluta con la distancia nueva: misma dirección, otra longitud.
// `ds` declara la fuente de la distancia cuando no es la de AT-HYG.
export function applyDistance(star, dNew, source) {
  const scale = dNew / star.d;
  const coordinate = value => Number((value * scale).toPrecision(7));
  return { ...star, x: coordinate(star.x), y: coordinate(star.y), z: coordinate(star.z), d: dNew,
    m: Number((star.m - 5 * Math.log10(scale)).toFixed(3)), ds: source };
}

// Campos de una anfitriona añadida que pasan al catálogo de la escena. La procedencia
// detallada (src), el ID Gaia y los alias quedan en added_hosts.json.
export function hostToStar(host) {
  const { i, n, x, y, z, d, m, c, sp, rgb, h, dataOrigin, src } = host;
  return { i, n, x, y, z, d, m, c, sp, rgb, h, dataOrigin, ds: /Gaia/.test(src.d) ? 'Gaia DR3' : 'NASA Exoplanet Archive' };
}

export function applyPatches(stars, { corrections = [], added = [] } = {}) {
  const byId = new Map(corrections.map(c => [c.i, c]));
  const ids = new Set(stars.map(s => s.i));
  const collisions = added.filter(h => ids.has(h.i));
  if (collisions.length) throw new Error(`ID de anfitriona repetido en el catálogo: ${collisions.map(h => h.i).join(', ')}`);
  return [
    ...stars.map(s => byId.has(s.i) ? applyDistance(s, byId.get(s.i).dNueva, byId.get(s.i).fuente) : s),
    ...added.map(hostToStar),
  ];
}

export function loadPatches() {
  const read = (file, key) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8'))[key] : [];
  return { corrections: read(CORRECTIONS_JSON, 'correcciones'), added: read(ADDED_HOSTS_JSON, 'stars') };
}
