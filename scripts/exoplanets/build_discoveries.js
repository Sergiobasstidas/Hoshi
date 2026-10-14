// scripts/exoplanets/build_discoveries.js
// Mapa de descubrimientos para el modo de exoplanetas: un punto por estrella con planetas
// confirmados (pscomppars) o candidatos (TOI de TESS, KOI de Kepler, K2), con tipo de planeta,
// misión y estado. Se sirve desde public/data/ y la app solo lo pide al abrir el modo.
// Uso: node scripts/exoplanets/build_discoveries.js
// Requiere los crudos de data/raw/exoplanets/ (ver FUENTES.md) y el catálogo procesado.

import fs from 'node:fs';
import { parse } from 'csv-parse/sync';
import { missionOf, planetType, typeFromNasa, MISSIONS, PLANET_TYPES, TYPE_MASS_LIMITS, TYPE_RADIUS_LIMITS } from '../../src/scene/descubrimientos.js';

const RAW = './data/raw/exoplanets';
const HOSTS_JSON = './data/catalog/exoplanet_host_identity.json';
const ADDED_JSON = './data/catalog/added_hosts.json';
const STARS_JSON = './data/processed/stars_15pc.json';
const OUTPUT_PATH = './public/data/exoplanet-discoveries.json';
const REPORT_PATH = './data/exoplanets/discoveries_report.json';

// Algunas celdas de pscomppars traen HTML con comillas sin escapar: relax_quotes, como process_exoplanets.js.
const readCsv = file => parse(fs.readFileSync(`${RAW}/${file}`, 'utf8'), { columns: true, skip_empty_lines: true, comment: '#', relax_quotes: true });
const num = v => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const round = v => Number(v.toPrecision(5));
function radecToXyz(raDeg, decDeg, distPc) {
  const ra = raDeg * Math.PI / 180, dec = decDeg * Math.PI / 180;
  return [distPc * Math.cos(dec) * Math.cos(ra), distPc * Math.cos(dec) * Math.sin(ra), distPc * Math.sin(dec)];
}

// Estrellas del catálogo de Hoshi: los sistemas confirmados que ya están en él usan su
// posición (con las correcciones de distancia aplicadas) para coincidir con la estrella.
const stars = new Map(JSON.parse(fs.readFileSync(STARS_JSON, 'utf8')).map(s => [s.i, s]));
const hostId = new Map(JSON.parse(fs.readFileSync(HOSTS_JSON, 'utf8')).hosts.filter(h => h.i !== null).map(h => [h.h, h.i]));
for (const star of JSON.parse(fs.readFileSync(ADDED_JSON, 'utf8')).stars) for (const host of star.hosts) hostId.set(host, star.i);

const facilities = [], facilityIndex = new Map();
const facility = (name, locale) => {
  if (!facilityIndex.has(name)) { facilityIndex.set(name, facilities.length); facilities.push({ n: name, g: missionOf(name, locale) }); }
  return facilityIndex.get(name);
};
const systems = [], systemByKey = new Map();
const skipped = { confirmados: [], toi: 0, koi: 0, k2: 0 };
function system(key, name, position, catalogueId, teff) {
  if (!systemByKey.has(key)) { systemByKey.set(key, systems.length); systems.push({ idx: systems.length, n: name, p: position, i: catalogueId, k: teff, planets: [] }); }
  return systems[systemByKey.get(key)];
}
const planets = [];
const addPlanet = (target, type, facilityId, candidate) => { target.planets.push(planets.length); planets.push({ s: target.idx, t: type, f: facilityId, c: candidate }); };

// === 1. Confirmados (pscomppars), con el tipo de su ficha del catálogo de la NASA ===
// (nasa_science_catalog_types.csv, de scripts/exoplanets/fetch_nasa_catalog_types.py).
// Los títulos traen entidades HTML («Teegarden&#8217;s Star b»); el archivo usa el apóstrofo recto.
const decodeTitle = title => title.replace(/&#(\d+);/g, (_, code) => code === '8217' || code === '8216' ? "'" : String.fromCharCode(Number(code))).replace(/&amp;/g, '&');
const nasaType = new Map(parse(fs.readFileSync(`${RAW}/nasa_science_catalog_types.csv`, 'utf8'), { columns: true, skip_empty_lines: true })
  .map(row => [decodeTitle(row.title), typeFromNasa(row.tipo_en_texto)]));
const typeSource = { ficha: 0, regla: 0, coincide: 0 };
const confirmed = readCsv('nasa_pscomppars.csv');
const ticHost = new Map();
for (const row of confirmed) {
  const id = hostId.get(row.hostname);
  const star = id !== undefined ? stars.get(id) : null;
  const ra = num(row.ra), dec = num(row.dec), dist = num(row.sy_dist);
  if (!star && (ra === null || dec === null || dist === null)) { skipped.confirmados.push(row.pl_name); continue; }
  const position = star ? [star.x, star.y, star.z] : radecToXyz(ra, dec, dist);
  const host = system(`h:${row.hostname}`, row.hostname, position, star ? id : -1, num(row.st_teff));
  const rule = planetType(num(row.pl_bmasse), num(row.pl_rade));
  const listed = nasaType.get(row.pl_name) ?? -1;
  if (listed >= 0) { typeSource.ficha++; if (listed === rule) typeSource.coincide++; } else typeSource.regla++;
  addPlanet(host, listed >= 0 ? listed : rule, facility(row.disc_facility, row.disc_locale), 0);
  if (row.tic_id) ticHost.set(row.tic_id.replace(/^TIC\s*/, ''), row.hostname);
}
const confirmedHost = name => systemByKey.has(`h:${name}`) ? systems[systemByKey.get(`h:${name}`)] : null;

// === 2. Candidatos de TESS: TOI con disposición PC o APC del TFOPWG (CP y KP ya están confirmados) ===
const tess = facility('Transiting Exoplanet Survey Satellite (TESS)', 'Space');
let toiCount = 0;
for (const row of readCsv('nasa_toi.csv')) {
  if (row.tfopwg_disp !== 'PC' && row.tfopwg_disp !== 'APC') continue;
  const known = confirmedHost(ticHost.get(row.tid));
  const ra = num(row.ra), dec = num(row.dec), dist = num(row.st_dist);
  if (!known && (ra === null || dec === null || dist === null)) { skipped.toi++; continue; }
  const host = known || system(`toi:${row.toipfx}`, `TOI-${row.toipfx}`, radecToXyz(ra, dec, dist), -1, num(row.st_teff));
  addPlanet(host, planetType(null, num(row.pl_rade)), tess, 1);
  toiCount++;
}

// === 3. Candidatos de Kepler: KOI «CANDIDATE» del cúmulo; distancia de keplerstellar (DR25) ===
const kepler = facility('Kepler', 'Space');
const koi = readCsv('nasa_koi_cumulative.csv');
const kepidHost = new Map();
for (const row of koi) if (row.koi_disposition === 'CONFIRMED' && row.kepler_name) {
  const host = row.kepler_name.replace(/\s+[a-z]$/, '');
  if (confirmedHost(host)) kepidHost.set(row.kepid, host);
}
// La entrega suplementaria de DR25 reemplaza a la principal cuando ambas existen.
const keplerDistance = new Map();
for (const row of readCsv('nasa_keplerstellar_koi.csv')) {
  const dist = num(row.dist);
  if (dist !== null && (!keplerDistance.has(row.kepid) || /supp/.test(row.st_delivname))) keplerDistance.set(row.kepid, dist);
}
let koiCount = 0;
for (const row of koi) {
  if (row.koi_disposition !== 'CANDIDATE') continue;
  const known = confirmedHost(kepidHost.get(row.kepid));
  const ra = num(row.ra), dec = num(row.dec), dist = keplerDistance.get(row.kepid) ?? null;
  if (!known && (ra === null || dec === null || dist === null)) { skipped.koi++; continue; }
  const name = `KOI-${Number(row.kepoi_name.replace(/^K0*/, '').split('.')[0])}`;
  const host = known || system(`koi:${row.kepid}`, name, radecToXyz(ra, dec, dist), -1, num(row.koi_steff));
  addPlanet(host, planetType(null, num(row.koi_prad)), kepler, 1);
  koiCount++;
}

// === 4. Candidatos de K2: k2pandc, fila por defecto con disposición «CANDIDATE» ===
const k2 = facility('K2', 'Space');
const k2rows = readCsv('nasa_k2pandc.csv').filter(row => row.default_flag === '1');
const epicHost = new Map(k2rows.filter(row => row.disposition === 'CONFIRMED').map(row => [row.epic_hostname, row.hostname]));
let k2Count = 0;
for (const row of k2rows) {
  if (row.disposition !== 'CANDIDATE') continue;
  const known = confirmedHost(epicHost.get(row.epic_hostname));
  const ra = num(row.ra), dec = num(row.dec), dist = num(row.sy_dist);
  if (!known && (ra === null || dec === null || dist === null)) { skipped.k2++; continue; }
  const host = known || system(`k2:${row.epic_hostname}`, row.hostname, radecToXyz(ra, dec, dist), -1, num(row.st_teff));
  addPlanet(host, planetType(num(row.pl_bmasse), num(row.pl_rade)), k2, 1);
  k2Count++;
}

// === 5. Salida columnar compacta ===
const out = {
  meta: {
    fuente: 'NASA Exoplanet Archive: pscomppars (confirmados), toi (PC y APC), cumulative (KOI CANDIDATE), k2pandc (CANDIDATE) y keplerstellar (distancias DR25)',
    descarga: '2026-10-13 (pscomppars) y 2026-10-14 (candidatos)',
    marco: 'pc, ecuatorial J2000, Sol en el origen; confirmados presentes en Hoshi con la posición de su estrella',
    tipos: `confirmados: tipo de la ficha de science.nasa.gov/exoplanet-catalog; sin ficha y candidatos: supertierra, tipo Neptuno y gigante desde ${TYPE_RADIUS_LIMITS.join(' / ')} R⊕ o ${TYPE_MASS_LIMITS.join(' / ')} M⊕ (gigante por masa si la hay; los demás por radio si lo hay)`,
    columnas: 'systems: n nombre, p [x,y,z] planos, i id de Hoshi (−1 si no está), k Teff (K) o 0; planets: s sistema, t tipo, f instalación, c 1 si candidato',
    tiposNombres: PLANET_TYPES.map(type => type.id), misiones: MISSIONS.map(mission => mission.id),
  },
  facilities,
  systems: { n: systems.map(s => s.n), p: systems.flatMap(s => s.p.map(round)), i: systems.map(s => s.i), k: systems.map(s => Math.round(s.k || 0)) },
  planets: { s: planets.map(p => p.s), t: planets.map(p => p.t), f: planets.map(p => p.f), c: planets.map(p => p.c) },
};
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(out));
const count = (filter) => planets.filter(filter).length;
const report = {
  sistemas: systems.length, sistemasEnHoshi: systems.filter(s => s.i >= 0).length,
  planetasConfirmados: count(p => !p.c), tipoConfirmados: { ...typeSource, acierto: Number((typeSource.coincide / typeSource.ficha).toFixed(4)) }, candidatos: { toi: toiCount, koi: koiCount, k2: k2Count },
  candidatosEnSistemasConfirmados: planets.filter(p => p.c && systems[p.s].planets.some(k => !planets[k].c)).length,
  porTipo: Object.fromEntries(PLANET_TYPES.map((type, t) => [type.id, { confirmados: count(p => !p.c && p.t === t), candidatos: count(p => p.c && p.t === t) }])),
  porMision: Object.fromEntries(MISSIONS.map((mission, g) => [mission.id, count(p => facilities[p.f].g === g)])),
  sinPosicion: { confirmados: skipped.confirmados.length, ejemplos: skipped.confirmados.slice(0, 20), toi: skipped.toi, koi: skipped.koi, k2: skipped.k2 },
  bytes: fs.statSync(OUTPUT_PATH).size,
};
fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
