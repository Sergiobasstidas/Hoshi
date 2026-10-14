// Clasificación y filtros del modo de descubrimientos de exoplanetas. Lo comparten el
// generador de datos (scripts/exoplanets/build_discoveries.js), la escena y las pruebas.

// Tipos de planeta del catálogo de la NASA (science.nasa.gov/exoplanet-catalog). Los
// confirmados usan el tipo que la NASA da a cada planeta en su ficha. La NASA no publica
// sus límites; los de abajo, para candidatos y planetas sin ficha, se ajustaron a esas
// fichas (coinciden con el 95,7 % de 6.304): gigante gaseoso desde 0,12 MJ; tipo Neptuno
// desde 2,1 R⊕; supertierra desde 1 R⊕. Ver docs/DOCUMENTACION.md.
export const PLANET_TYPES = [
  { id: 'gigante', nombre: 'Gigante gaseoso', color: '#ffb45e', nasa: 'gas giant' },
  { id: 'neptuno', nombre: 'Tipo Neptuno', color: '#62c9ff', nasa: 'neptune-like' },
  { id: 'supertierra', nombre: 'Supertierra', color: '#8ff0b8', nasa: 'super earth' },
  { id: 'terrestre', nombre: 'Terrestre', color: '#ff8f7d', nasa: 'terrestrial' },
  { id: 'desconocido', nombre: 'Sin tamaño medido', color: '#c9cdd8', nasa: 'unknown' },
];
export const UNKNOWN_TYPE = 4;
export const JUPITER_EARTH_MASSES = 317.83;
// Relación masa-radio de Chen y Kipping (2017), la que usa el archivo de la NASA para las
// masas calculadas: R = M^0,279 por debajo de 2,04 M⊕ y R = 0,808 M^0,589 por encima.
export function chenKippingRadius(massEarth) {
  return massEarth < 2.04 ? massEarth ** 0.279 : 0.808 * massEarth ** 0.589;
}
export function chenKippingMass(radiusEarth) {
  return radiusEarth < 2.04 ** 0.279 ? radiusEarth ** (1 / 0.279) : (radiusEarth / 0.808) ** (1 / 0.589);
}
const GIANT_MASS = 0.12 * JUPITER_EARTH_MASSES;
// Límites inferiores de supertierra, tipo Neptuno y gigante gaseoso, en R⊕ y en M⊕;
// cada par se convierte con la relación anterior.
export const TYPE_RADIUS_LIMITS = [1, 2.1, Number(chenKippingRadius(GIANT_MASS).toFixed(2))];
export const TYPE_MASS_LIMITS = [Number(chenKippingMass(1).toFixed(2)), Number(chenKippingMass(2.1).toFixed(2)), Number(GIANT_MASS.toFixed(2))];

// Gigante por masa si la hay (la NASA marca así a planetas hinchados de poca masa como
// WASP-107 b, «tipo Neptuno»); los demás límites por radio si lo hay, si no por masa.
export function planetType(massEarth, radiusEarth) {
  const mass = Number.isFinite(massEarth) && massEarth > 0 ? massEarth : null;
  const radius = Number.isFinite(radiusEarth) && radiusEarth > 0 ? radiusEarth : null;
  if (mass === null && radius === null) return UNKNOWN_TYPE;
  if (mass !== null ? mass >= TYPE_MASS_LIMITS[2] : radius >= TYPE_RADIUS_LIMITS[2]) return 0;
  const [value, limits] = radius !== null ? [radius, TYPE_RADIUS_LIMITS] : [mass, TYPE_MASS_LIMITS];
  return value >= limits[1] ? 1 : value >= limits[0] ? 2 : 3;
}
export const typeFromNasa = label => PLANET_TYPES.findIndex(type => type.nasa === (label || '').toLowerCase());

// Misiones: instalación de descubrimiento (disc_facility) y lugar (disc_locale) de pscomppars.
export const MISSIONS = [
  { id: 'kepler', nombre: 'Kepler', icono: 'telescopio' },
  { id: 'k2', nombre: 'K2', icono: 'telescopio' },
  { id: 'tess', nombre: 'TESS', icono: 'satelite' },
  { id: 'corot', nombre: 'CoRoT', icono: 'satelite' },
  { id: 'gaia', nombre: 'Gaia', icono: 'satelite' },
  { id: 'espacio', nombre: 'Otras', icono: 'satelite', detalle: 'Otros telescopios espaciales (Hubble, Spitzer, CHEOPS, JWST, WISE) y descubrimientos con varias instalaciones' },
  { id: 'tierra', nombre: 'Desde tierra', icono: 'observatorio', detalle: 'Observatorios en tierra: La Silla, Keck, WASP, HAT, OGLE, KMTNet y otros' },
];
const FACILITY_MISSION = {
  'Kepler': 'kepler', 'K2': 'k2', 'Transiting Exoplanet Survey Satellite (TESS)': 'tess',
  'CoRoT': 'corot', 'European Space Agency (ESA) Gaia Satellite': 'gaia',
};
export function missionOf(facility, locale) {
  const id = FACILITY_MISSION[facility] || (/^space$/i.test(locale || '') ? 'espacio' : /^ground$/i.test(locale || '') ? 'tierra' : 'espacio');
  return MISSIONS.findIndex(mission => mission.id === id);
}

export const STATUS = [
  { id: 'todos', nombre: 'Todos' },
  { id: 'confirmados', nombre: 'Confirmados' },
  { id: 'candidatos', nombre: 'Candidatos' },
];
export const DEFAULT_FILTER = { estado: 'todos', tipo: 'todos', mision: 'todas', color: 'estrella' };
export const COLOR_MODES = [
  { id: 'estrella', nombre: 'Estrella' },
  { id: 'tipo', nombre: 'Tipo de planeta' },
  { id: 'mision', nombre: 'Misión' },
];
export const MISSION_COLORS = ['#ffd36b', '#ffa45c', '#7fb6ff', '#d59bff', '#7ff0e0', '#f5f5f5', '#9aa7c2'];

// Prueba de un planeta del archivo (columnas s, t, f, c) contra los filtros. Un filtro
// puede omitirse con `skip` para contar las pestañas de esa fila con las otras dos activas.
export function planetMatches(data, k, filter, skip) {
  const { planets, facilities } = data;
  if (skip !== 'estado' && filter.estado !== 'todos' && planets.c[k] !== (filter.estado === 'candidatos' ? 1 : 0)) return false;
  if (skip !== 'tipo' && filter.tipo !== 'todos' && PLANET_TYPES[planets.t[k]].id !== filter.tipo) return false;
  if (skip !== 'mision' && filter.mision !== 'todas' && MISSIONS[facilities[planets.f[k]].g].id !== filter.mision) return false;
  return true;
}

// Sistemas visibles con un filtro y, por sistema, sus planetas que pasan.
export function filterSystems(data, filter) {
  const matches = new Map();
  const { planets } = data;
  for (let k = 0; k < planets.s.length; k++) {
    if (!planetMatches(data, k, filter)) continue;
    const list = matches.get(planets.s[k]);
    if (list) list.push(k); else matches.set(planets.s[k], [k]);
  }
  return matches;
}

// Recuentos de planetas por pestaña de cada fila, con los filtros de las demás filas activos.
export function countTabs(data, filter) {
  const counts = { estado: {}, tipo: {}, mision: {} };
  const { planets, facilities } = data;
  const bump = (row, id) => { counts[row][id] = (counts[row][id] || 0) + 1; };
  for (let k = 0; k < planets.s.length; k++) {
    if (planetMatches(data, k, filter, 'estado')) { bump('estado', 'todos'); bump('estado', planets.c[k] ? 'candidatos' : 'confirmados'); }
    if (planetMatches(data, k, filter, 'tipo')) { bump('tipo', 'todos'); bump('tipo', PLANET_TYPES[planets.t[k]].id); }
    if (planetMatches(data, k, filter, 'mision')) { bump('mision', 'todas'); bump('mision', MISSIONS[facilities[planets.f[k]].g].id); }
  }
  return counts;
}

// Tipo dominante de un sistema para el color: el planeta de mayor categoría que pasa el filtro.
export function dominantType(data, list) {
  let best = UNKNOWN_TYPE;
  for (const k of list) if (data.planets.t[k] < best) best = data.planets.t[k];
  return best;
}

// Resumen de un sistema para la etiqueta flotante.
export function describeSystem(data, index, list) {
  const { planets, facilities, systems } = data;
  const all = [];
  for (let k = 0; k < planets.s.length; k++) if (planets.s[k] === index) all.push(k);
  const confirmed = all.filter(k => !planets.c[k]).length;
  const types = PLANET_TYPES.map((type, t) => ({ ...type, n: list.filter(k => planets.t[k] === t).length })).filter(type => type.n);
  const missions = [...new Set(list.map(k => facilities[planets.f[k]].n))];
  const [x, y, z] = [0, 1, 2].map(axis => systems.p[index * 3 + axis]);
  return { name: systems.n[index], confirmed, candidates: all.length - confirmed, types, missions,
    distancePc: Math.hypot(x, y, z), inHoshi: systems.i[index] >= 0, mission: MISSIONS[facilities[planets.f[list[0]]].g] };
}
