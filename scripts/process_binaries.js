// scripts/process_binaries.js
// Construye data/processed/star_systems.json: componentes de sistemas múltiples
// a partir de ORB6 (órbitas) y WDS (pares físicos sin órbita), cruzados con el
// catálogo de Hoshi. Véase docs/BINARIAS.md.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { parse } from 'csv-parse/sync';
import { besselianYearToMjd } from '../src/scene/visualBinary.js';
import { parseComponents } from './multiplicity.js';
import { PUBLISHED_BINARY_MASSES } from './published_binary_masses.js';

const ORBITS_PATH = 'data/raw/multiplicity/orb6orbits.txt';
const WDS_PATH = 'data/raw/multiplicity/wdsweb_summ2.txt';
const MSC_DIR = 'data/raw/multiplicity/msc';
const SB9_DIR = 'data/raw/multiplicity/sb9';
// Tolerancia de período para reconocer la misma órbita en SB9 y en ORB6.
const SB9_PERIOD_TOLERANCE = 0.05;
// Grado mínimo del MSC: 3 o más son jerarquías aceptadas; 1 y 2, refutadas o dudosas.
const MSC_MIN_GRADE = 3;
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
  wide: 0, widePhysical: 0, wideMatched: 0, wideKept: 0,
  published: 0, sb9: 0, mscSystems: 0, mscRooted: 0, mscMasses: 0, mscWide: 0, mscHidden: 0, mscCompanions: 0 };
const systems = new Map(); // id del catálogo → { wds, pairs: Map(clave → par) }
const rootByWds = new Map();
const system = (id, wds) => {
  if (!systems.has(id)) systems.set(id, { wds, pairs: new Map(), hidden: [] });
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

// ---------- MSC: masas, jerarquía y subsistemas sin orientación ----------
const readMsc = name => zlib.gunzipSync(fs.readFileSync(`${MSC_DIR}/${name}`)).toString('latin1').split('\n');
const mscComponents = new Map(); // WDS → { etiqueta → { hip, hd, ra, dec, v } }
const mscGrade = new Map();
for (const line of readMsc('catalog.dat.gz')) {
  const cols = line.split('|');
  if (cols.length < 20) continue;
  const wds = cols[0].trim(), [ra, dec] = cols[1].trim().split(/\s+/).map(Number), label = cols[7].trim();
  if (!mscComponents.has(wds)) mscComponents.set(wds, {});
  mscComponents.get(wds)[label] = { ra, dec, hip: Number(cols[10]) || null, hd: Number(cols[11]) || null, v: Number(cols[13]) || null };
  if (Number(cols[19]) > 0) mscGrade.set(wds, Number(cols[19]));
}
const catalogueId = component => byHip.get(component?.hip) ?? byHd.get(component?.hd);
const DAYS = { d: 1, y: 365.25, k: 365250, M: 365250000 }, ARCSEC = { '"': 1, "'": 60, m: 0.001 };
for (const line of readMsc('systems.dat.gz')) {
  const cols = line.split('|');
  if (cols.length < 18) continue;
  const wds = cols[0].trim(), primary = cols[1].trim(), secondary = cols[2].trim(), type = cols[4].trim();
  if (!primary || !secondary || type.includes('X') || !((mscGrade.get(wds) || 0) >= MSC_MIN_GRADE)) continue;
  counts.mscSystems++;
  const components = mscComponents.get(wds) || {};
  let id = rootByWds.get(wds);
  if (id === undefined) {
    const main = components.A || Object.values(components)[0];
    id = catalogueId(main) ?? (main ? nearest(main.ra, main.dec, MATCH_ARCSEC, main.v, null)?.i : undefined);
  }
  const star = byId.get(id);
  if (!star) continue;
  counts.mscRooted++;
  const entry = system(id, wds), key = `${anchor(primary)}>${secondary}`;
  const period = Number(cols[5]) * (DAYS[cols[6].trim()] || 0), sep = Number(cols[7]) * (ARCSEC[cols[8].trim()] || 0), pa = Number(cols[9]);
  const m1 = Number(cols[14]) || null, m2 = Number(cols[16]) || null;
  const v2 = Number(cols[12]) || null, sp2 = cols[13].trim();
  // El MSC a veces nombra distinto el mismo par (Capella: «A,B» frente a «Aa,Ab»): se
  // reconoce por compartir ancla y período, o ancla y separación.
  const same = pair => pair.of === anchor(primary) && (pair.k === 'o'
    ? period > 0 && Math.abs(pair.p - period) / period < 0.05
    : sep > 0 && Math.abs(pair.rho - sep * star.d) / (sep * star.d) < 0.1);
  const known = entry.pairs.get(key) || [...entry.pairs.values()].find(same);
  if (known) {
    // Par ya dibujado: añadir masas estimadas y completar el tipo espectral.
    if (m1 && m2) { known.m1 = m1; known.m2 = m2; known.mc = cols[15].trim() + cols[17].trim(); counts.mscMasses++; }
    if (!known.sp && sp2) known.sp = sp2;
    continue;
  }
  const rhoAu = sep * star.d;
  if (pa > 0 && pa <= 360 && sep >= WIDE_RHO_ARCSEC[0] && rhoAu <= WIDE_MAX_AU && /[Ccv]/.test(type)) {
    // Compañera resuelta con ángulo de posición: par ancho.
    entry.pairs.set(key, { n: secondary, of: anchor(primary), k: 'w', pair: 'MSC', rho: +rhoAu.toPrecision(5), theta: pa,
      v1: Number(cols[10]) || null, v: v2, ...(sp2 ? { sp: sp2 } : {}), ...(m1 && m2 ? { m1, m2 } : {}) });
    counts.mscWide++;
  } else {
    // Sin orientación medida no se puede situar en 3D: se informa en la ficha, no se dibuja.
    entry.hidden.push({ n: secondary, of: anchor(primary), type, ...(period ? { p: +period.toPrecision(6) } : {}), ...(m2 ? { m2 } : {}) });
    counts.mscHidden++;
  }
}

// ---------- Masas de pares que el MSC no cubre: publicadas y SB9 ----------
// SB9: en una binaria de doble línea K1/K2 = m2/m1, medido. La masa total sale de la
// órbita visual (a³/P², con la distancia del catálogo); el reparto, de SB9.
const sb9Hip = new Map();
for (const line of fs.readFileSync(`${SB9_DIR}/main.dat`, 'latin1').split('\n')) {
  const match = /HIP\s*(\d+)/.exec(line.slice(103));
  if (match) sb9Hip.set(Number(line.slice(0, 4)), Number(match[1]));
}
const sb9ByStar = new Map();
for (const line of fs.readFileSync(`${SB9_DIR}/orbits.dat`, 'latin1').split('\n')) {
  if (line.length < 160) continue;
  const id = byHip.get(sb9Hip.get(Number(line.slice(0, 4))));
  const period = Number(line.slice(7, 23)), k1 = Number(line.slice(123, 133)), k2 = Number(line.slice(147, 157));
  if (id === undefined || !(period > 0 && k1 > 0 && k2 > 0)) continue;
  if (!sb9ByStar.has(id)) sb9ByStar.set(id, []);
  sb9ByStar.get(id).push({ period, k1, k2, grade: Number(line.slice(225, 228)) || 0, ref: line.slice(229, 280).trim() });
}
for (const [id, entry] of systems) {
  for (const [key, pair] of entry.pairs) {
    if (pair.k !== 'o' || pair.m1) continue;
    const published = PUBLISHED_BINARY_MASSES[`${entry.wds}|${key}`];
    if (published) { Object.assign(pair, { m1: published.m1, m2: published.m2, mc: 'pub', ms: published.source }); counts.published++; continue; }
    const match = (sb9ByStar.get(id) || []).filter(orbit => Math.abs(orbit.period - pair.p) / pair.p < SB9_PERIOD_TOLERANCE)
      .sort((a, b) => b.grade - a.grade)[0];
    if (!match) continue;
    const total = match.k1 + match.k2;
    Object.assign(pair, { m1: +(pair.mass * match.k2 / total).toPrecision(3), m2: +(pair.mass * match.k1 / total).toPrecision(3),
      mc: 'sb9', ms: match.ref });
    counts.sb9++;
  }
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
    // El MSC identifica cada componente: si tiene HIP o HD propio y está en el catálogo, es ese registro.
    const listed = catalogueId(mscComponents.get(entry.wds)?.[pair.n]);
    if (listed !== undefined && listed !== id) { if (pair.cid !== listed) counts.mscCompanions++; pair.cid = listed; }
    if (pair.v === null) delete pair.v;
    if (pair.v1 === null) delete pair.v1;
  }
  // Subsistemas no dibujables: solo los que cuelgan de una componente colocada y no repiten una dibujada.
  const hidden = entry.hidden.filter(item => placed.has(item.of) && !placed.has(item.n));
  if (comps.length) { output[id] = { wds: entry.wds, comps, ...(hidden.length ? { hidden } : {}) }; counts.components += comps.length; }
}
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output));
const all = Object.values(output).flatMap(entry => entry.comps);
console.log(`ORB6: ${counts.orbits} órbitas; ${counts.incomplete} incompletas o sin componentes legibles, ${counts.grade} de grado > ${MAX_GRADE}, `
  + `${counts.unmatched} sin cruce HIP/HD, ${counts.mass} con masa dinámica fuera de rango.`);
console.log(`WDS: ${counts.wide} pares; ${counts.widePhysical} físicos sin órbita aceptada, ${counts.wideMatched} cruzados, ${counts.wideKept} dentro de ${WIDE_MAX_AU} UA.`);
console.log(`MSC: ${counts.mscSystems} pares de grado ≥ ${MSC_MIN_GRADE}; ${counts.mscRooted} con primaria en el catálogo; ${counts.mscMasses} aportan masas a pares ya dibujados, `
  + `${counts.mscWide} son compañeras nuevas con ángulo de posición, ${counts.mscHidden} quedan sin dibujar por falta de orientación; ${counts.mscCompanions} compañeras identificadas por HIP/HD.`);
console.log(`Masas fuera del MSC: ${counts.published} pares con masas dinámicas publicadas, ${counts.sb9} con razón de masas de SB9.`);
console.log(`✓ ${Object.keys(output).length} sistemas, ${all.length} componentes (${all.filter(c => c.k === 'o').length} con órbita, `
  + `${all.filter(c => c.k === 'w').length} pares anchos); ${all.filter(c => c.cid).length} ya presentes en el catálogo; `
  + `${all.filter(c => c.sp).length} con tipo espectral. ${OUTPUT_PATH}`);
