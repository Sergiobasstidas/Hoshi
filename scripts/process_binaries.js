// scripts/process_binaries.js
// Cruza el Sixth Catalog of Orbits of Visual Binary Stars (ORB6) con el catálogo
// de Hoshi y escribe data/processed/binary_orbits.json. Véase docs/BINARIAS.md.
import fs from 'node:fs';
import { parse } from 'csv-parse/sync';
import { besselianYearToMjd } from '../src/scene/visualBinary.js';

const ORBITS_PATH = 'data/raw/multiplicity/orb6orbits.txt';
const OUTPUT_PATH = 'data/processed/binary_orbits.json';
// Grados ORB6: 1 definitiva, 2 buena, 3 fiable. Los grados 4, 5, 8 y 9 se descartan.
const MAX_GRADE = 3;
// Masa total dinámica admitida (masas solares): descarta cruces o distancias incoherentes.
const MASS_RANGE = [0.05, 150];

const field = (line, start, length) => line.slice(start - 1, start - 1 + length).trim();
const number = text => (text === '' || text === '.' ? null : Number(text));

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

const counts = { total: 0, incomplete: 0, grade: 0, unmatched: 0, mass: 0, kept: 0 };
const candidates = new Map();
for (const line of fs.readFileSync(ORBITS_PATH, 'utf8').split('\n')) {
  if (!/^\d{6}\.\d{2}[+-]\d{6}/.test(line)) continue;
  counts.total++;
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
  if (!days || !arcsec || mjd === null) { counts.incomplete++; continue; }
  const id = byHip.get(number(field(line, 59, 6))) ?? byHd.get(number(field(line, 52, 6)));
  const star = byId.get(id);
  if (!star || !(star.d > 0)) { counts.unmatched++; continue; }
  // a[UA] = a[rad] · d[UA]; con d en pc equivale a segundos de arco × pc.
  const axisAu = axis * arcsec * star.d;
  const years = period * days / 365.25;
  const mass = axisAu ** 3 / years ** 2;
  if (mass < MASS_RANGE[0] || mass > MASS_RANGE[1]) { counts.mass++; continue; }
  const entry = {
    pair: field(line, 31, 14).replace(/\s+/g, ' '), wds: field(line, 20, 10),
    p: +(period * days).toPrecision(9), t: +mjd.toFixed(3), e: eccentricity, a: +axisAu.toPrecision(6),
    i: inclination, node, w: omega, nodeKnown: line[151] === '*' || line[151] === 'q',
    grade, ref: field(line, 238, 8), mass: +mass.toPrecision(3),
    v1: number(field(line, 67, 5)), v2: number(field(line, 74, 5)),
  };
  // Una órbita por registro del catálogo: mejor grado y, a igualdad, el par más ancho.
  const current = candidates.get(id);
  if (!current || entry.grade < current.grade || (entry.grade === current.grade && entry.a > current.a)) candidates.set(id, entry);
}

// Si la compañera ya es un registro propio del catálogo (misma distancia y a pocas
// veces el apoastro en el cielo), se anota para no dibujarla dos veces.
const ARCSEC_PER_RAD = 648000 / Math.PI;
const direction = star => { const r = Math.hypot(star.x, star.y, star.z); return [star.x / r, star.y / r, star.z / r]; };
const sorted = stars.filter(star => star.d > 0 && Math.hypot(star.x, star.y, star.z) > 0).sort((a, b) => a.d - b.d);
for (const [id, entry] of candidates) {
  const star = byId.get(id), u = direction(star);
  // Las posiciones procesadas están redondeadas a 0,001 pc: sumar esa imprecisión angular.
  const limit = Math.max(5, 4 * entry.a * (1 + entry.e) / star.d) + 0.001 / star.d * ARCSEC_PER_RAD;
  for (const other of sorted) {
    if (other.d < star.d * 0.9) continue;
    if (other.d > star.d * 1.1) break;
    if (other.i === id) continue;
    const v = direction(other);
    const separation = Math.acos(Math.min(1, u[0] * v[0] + u[1] * v[1] + u[2] * v[2])) * ARCSEC_PER_RAD;
    if (separation < limit) { entry.companionId = other.i; counts.resolved = (counts.resolved || 0) + 1; break; }
  }
}
const output = Object.fromEntries([...candidates].sort((a, b) => a[0] - b[0]));
counts.kept = candidates.size;
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output));
console.log(`ORB6: ${counts.total} órbitas leídas; ${counts.incomplete} incompletas, ${counts.grade} de grado > ${MAX_GRADE}, `
  + `${counts.unmatched} sin cruce HIP/HD, ${counts.mass} con masa dinámica fuera de rango.`);
console.log(`✓ ${counts.kept} sistemas con órbita en ${OUTPUT_PATH}; ${counts.resolved || 0} con la compañera ya presente en el catálogo.`);
