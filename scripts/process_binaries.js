// scripts/process_binaries.js
// Construye data/processed/star_systems.json: componentes de sistemas múltiples
// a partir de ORB6 (órbitas) y WDS (pares físicos sin órbita), cruzados con el
// catálogo de Hoshi. Véase docs/BINARIAS.md.
import fs from 'node:fs';
import { parse } from 'csv-parse/sync';
import { besselianYearToMjd } from '../src/scene/visualBinary.js';
import { parseComponents } from './multiplicity.js';

const ORBITS_PATH = 'data/raw/multiplicity/orb6orbits.txt';
const WDS_PATH = 'data/raw/multiplicity/wdsweb_summ2.txt';
const OUTPUT_PATH = 'data/processed/star_systems.json';
// Grados ORB6: 1 definitiva, 2 buena, 3 fiable. Los grados 4, 5, 8 y 9 se descartan.
const MAX_GRADE = 3;
// Masa total dinámica admitida (masas solares): descarta cruces o distancias incoherentes.
const MASS_RANGE = [0.05, 150];
// Pares anchos: separación observada mínima y máxima (″) y proyectada máxima (UA).
const WIDE_RHO_ARCSEC = [0.1, 999];
const WIDE_MAX_AU = 20000;
// Cruce por posición: tolerancia angular (″) y de magnitud V.
const MATCH_ARCSEC = 15, MATCH_MAG = 1.5;
const ARCSEC_PER_RAD = 648000 / Math.PI;

const field = (line, start, length) => line.slice(start - 1, start - 1 + length).trim();
const number = text => (text === '' || text === '.' ? null : Number(text));

// El primer miembro de un par se ancla en la componente de su primera letra.
const anchor = component => component[0];

// ---------- Catálogo ----------
const stars = JSON.parse(fs.readFileSync('data/processed/stars_15pc.json', 'utf8'));
const byId = new Map(stars.map(star => [star.i, star]));
const rows = parse(fs.readFileSync('data/raw/hyglike_from_athyg_v32.csv', 'utf8'), { columns: true });
const byHip = new Map(), byHd = new Map();
for (const row of rows) {
  const id = Number(row.id);
  if (!byId.has(id)) continue;
  if (row.hip) byHip.set(Number(row.hip), id);
  if (row.hd) byHd.set(Number(row.hd), id);
}
const sky = new Map();
const cell = (ra, dec) => `${Math.floor(ra * 10)}:${Math.floor((dec + 90) * 10)}`;
for (const star of stars) {
  const r = Math.hypot(star.x, star.y, star.z);
  if (!(r > 0)) continue;
  star.ra = (Math.atan2(star.y, star.x) * 180 / Math.PI + 360) % 360;
  star.dec = Math.asin(star.z / r) * 180 / Math.PI;
  star.v = star.m + 5 * Math.log10(star.d / 10);
  const key = cell(star.ra, star.dec);
  if (!sky.has(key)) sky.set(key, []);
  sky.get(key).push(star);
}
const separation = (ra1, dec1, ra2, dec2) => {
  const dra = ((ra2 - ra1 + 540) % 360 - 180) * Math.cos(dec1 * Math.PI / 180);
  return Math.hypot(dra, dec2 - dec1) * 3600;
};
// Estrella del catálogo más próxima a una posición, con magnitud compatible si se conoce.
function nearest(ra, dec, limit, magnitude, exclude) {
  let best = null;
  const span = limit / 3600 + 0.1, cosDec = Math.max(0.05, Math.cos(dec * Math.PI / 180));
  for (let a = ra - span / cosDec; a <= ra + span / cosDec + 0.1; a += 0.1) {
    for (let d = dec - span; d <= dec + span + 0.1; d += 0.1) {
      for (const star of sky.get(cell((a + 360) % 360, Math.max(-90, Math.min(89.99, d)))) || []) {
        if (star.i === exclude) continue;
        const distance = separation(ra, dec, star.ra, star.dec);
        if (distance > limit || (magnitude !== null && Math.abs(star.v - magnitude) > MATCH_MAG)) continue;
        if (!best || distance < best.distance) best = { star, distance };
      }
    }
  }
  return best?.star || null;
}

// ---------- ORB6 ----------
const counts = { orbits: 0, incomplete: 0, grade: 0, unmatched: 0, mass: 0, components: 0,
  wide: 0, widePhysical: 0, wideMatched: 0, wideKept: 0 };
const systems = new Map(); // id del catálogo → { wds, pairs: Map(clave → par) }
const rootByWds = new Map();
const system = (id, wds) => {
  if (!systems.has(id)) systems.set(id, { wds, pairs: new Map() });
  if (wds && !rootByWds.has(wds)) rootByWds.set(wds, id);
  return systems.get(id);
};
for (const line of fs.readFileSync(ORBITS_PATH, 'utf8').split('\n')) {
  if (!/^\d{6}\.\d{2}[+-]\d{6}/.test(line)) continue;
  counts.orbits++;
  const period = number(field(line, 82, 11)), periodUnit = line[92];
  const axis = number(field(line, 106, 9)), axisUnit = line[114];
  const inclination = number(field(line, 126, 8)), node = number(field(line, 144, 8));
  const epoch = number(field(line, 163, 12)), epochUnit = line[174];
  const eccentricity = number(field(line, 188, 8)), omega = number(field(line, 206, 8));
  const grade = number(field(line, 234, 1));
  if ([period, axis, inclination, node, epoch, eccentricity, omega].some(v => v === null || !Number.isFinite(v))
    || eccentricity >= 1 || period <= 0 || axis <= 0) { counts.incomplete++; continue; }
  if (!(grade >= 1 && grade <= MAX_GRADE)) { counts.grade++; continue; }
  const days = { d: 1, y: 365.25, c: 36525 }[periodUnit];
  const arcsec = { a: 1, m: 0.001, M: 60 }[axisUnit];
  const mjd = epochUnit === 'y' ? besselianYearToMjd(epoch) : epochUnit === 'c' ? besselianYearToMjd(epoch * 100)
    : epochUnit === 'd' ? epoch - 0.5 : epochUnit === 'm' ? epoch : null;
  const components = parseComponents(line.slice(37, 44));
  if (!days || !arcsec || mjd === null || !components) { counts.incomplete++; continue; }
  const id = byHip.get(number(field(line, 59, 6))) ?? byHd.get(number(field(line, 52, 6)));
  const star = byId.get(id);
  if (!star || !(star.d > 0)) { counts.unmatched++; continue; }
  // a[UA] = segundos de arco × distancia del catálogo en pc.
  const axisAu = axis * arcsec * star.d;
  const mass = axisAu ** 3 / (period * days / 365.25) ** 2;
  if (mass < MASS_RANGE[0] || mass > MASS_RANGE[1]) { counts.mass++; continue; }
  const pair = {
    n: components[1], of: anchor(components[0]), k: 'o', pair: line.slice(30, 37).replace(/\s+/g, ' ').trim(),
    p: +(period * days).toPrecision(9), t: +mjd.toFixed(3), e: eccentricity, a: +axisAu.toPrecision(6),
    i: inclination, node, w: omega, nodeKnown: line[151] === '*' || line[151] === 'q',
    grade, ref: field(line, 238, 8), mass: +mass.toPrecision(3),
    v1: number(field(line, 67, 5)), v: number(field(line, 74, 5)),
  };
  // Una órbita por par de componentes: la de mejor grado.
  const target = system(id, field(line, 20, 10)), key = `${pair.of}>${pair.n}`;
  const current = target.pairs.get(key);
  if (!current || pair.grade < current.grade) target.pairs.set(key, pair);
}

// ---------- WDS: tipos espectrales y pares físicos sin órbita ----------
const PHYSICAL = /[TVZ]/, NOT_PHYSICAL = /[SUYX]/;
for (const line of fs.readFileSync(WDS_PATH, 'utf8').split('\n')) {
  if (!/^\d{5}[+-]\d{4}/.test(line)) continue;
  counts.wide++;
  const wds = line.slice(0, 10), components = parseComponents(line.slice(17, 22));
  if (!components) continue;
  const spectral = field(line, 71, 9).split('+');
  const key = `${anchor(components[0])}>${components[1]}`;
  // Completar el tipo espectral de la compañera en pares que ya tienen órbita.
  const known = systems.get(rootByWds.get(wds))?.pairs.get(key);
  if (known) { if (spectral[1]) known.sp = spectral[1]; continue; }
  const notes = line.slice(107, 111);
  if (!PHYSICAL.test(notes) || NOT_PHYSICAL.test(notes)) continue;
  counts.widePhysical++;
  const rho = number(field(line, 53, 5)), theta = number(field(line, 43, 3)), year = number(field(line, 29, 4));
  // Un ángulo de posición negativo en WDS significa «desconocido».
  if (rho === null || theta === null || theta < 0 || theta > 360 || !(rho >= WIDE_RHO_ARCSEC[0] && rho <= WIDE_RHO_ARCSEC[1])) continue;
  const v1 = number(field(line, 59, 5)), v2 = number(field(line, 65, 5));
  // La raíz es la componente A: la del catálogo de órbitas o, si el par parte de A, por posición.
  let id = rootByWds.get(wds);
  if (id === undefined && anchor(components[0]) === 'A') {
    const precise = line.slice(112, 130).match(/^(\d{2})(\d{2})(\d{2}\.\d+)([+-])(\d{2})(\d{2})(\d{2}(?:\.\d+)?)/);
    if (!precise) continue;
    const ra = (Number(precise[1]) + Number(precise[2]) / 60 + Number(precise[3]) / 3600) * 15;
    const dec = (precise[4] === '-' ? -1 : 1) * (Number(precise[5]) + Number(precise[6]) / 60 + Number(precise[7]) / 3600);
    id = nearest(ra, dec, MATCH_ARCSEC, v1, null)?.i;
  }
  const star = byId.get(id);
  if (!star) continue;
  counts.wideMatched++;
  const rhoAu = rho * star.d;
  if (rhoAu > WIDE_MAX_AU) continue;
  system(id, wds).pairs.set(key, { n: components[1], of: anchor(components[0]), k: 'w',
    pair: line.slice(10, 17).replace(/\s+/g, ' ').trim(), rho: +rhoAu.toPrecision(5), theta, year,
    v1, v: v2, ...(spectral[1] ? { sp: spectral[1] } : {}) });
  counts.wideKept++;
}

// ---------- Jerarquía y compañeras ya presentes en el catálogo ----------
const output = {};
for (const [id, entry] of [...systems].sort((a, b) => a[0] - b[0])) {
  const root = byId.get(id), placed = new Set(['A']), comps = [];
  const pending = [...entry.pairs.values()].sort((a, b) => (a.k === 'o' ? a.a : a.rho) - (b.k === 'o' ? b.a : b.rho));
  // Colocar primero los pares cuyo ancla ya existe; repetir hasta agotar.
  for (let progress = true; progress;) {
    progress = false;
    for (const pair of pending) {
      if (placed.has(pair.n) || !placed.has(pair.of)) continue;
      placed.add(pair.n); comps.push(pair); progress = true;
    }
  }
  for (const pair of comps) {
    // ¿La compañera es un registro propio del catálogo? Se busca cerca de la primaria,
    // a una distancia parecida y con magnitud compatible.
    const reach = Math.max(5, 1.5 * (pair.k === 'o' ? pair.a * (1 + pair.e) : pair.rho) / root.d) + 0.001 / root.d * ARCSEC_PER_RAD;
    const match = pair.of === 'A' && pair.v !== null ? nearest(root.ra, root.dec, Math.min(reach, 1200), pair.v, id) : null;
    if (match && Math.abs(match.d - root.d) / root.d < 0.25) pair.cid = match.i;
    if (pair.v === null) delete pair.v;
    if (pair.v1 === null) delete pair.v1;
  }
  if (comps.length) { output[id] = { wds: entry.wds, comps }; counts.components += comps.length; }
}
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output));
const all = Object.values(output).flatMap(entry => entry.comps);
console.log(`ORB6: ${counts.orbits} órbitas; ${counts.incomplete} incompletas o sin componentes legibles, ${counts.grade} de grado > ${MAX_GRADE}, `
  + `${counts.unmatched} sin cruce HIP/HD, ${counts.mass} con masa dinámica fuera de rango.`);
console.log(`WDS: ${counts.wide} pares; ${counts.widePhysical} físicos sin órbita aceptada, ${counts.wideMatched} cruzados, ${counts.wideKept} dentro de ${WIDE_MAX_AU} UA.`);
console.log(`✓ ${Object.keys(output).length} sistemas, ${all.length} componentes (${all.filter(c => c.k === 'o').length} con órbita, `
  + `${all.filter(c => c.k === 'w').length} pares anchos); ${all.filter(c => c.cid).length} ya presentes en el catálogo; `
  + `${all.filter(c => c.sp).length} con tipo espectral. ${OUTPUT_PATH}`);
