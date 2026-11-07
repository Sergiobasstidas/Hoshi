// scripts/process_gaia.js
// Lee la descarga cruda de Gaia DR3 (data/raw/gaia/gaia_dr3_1m.csv.gz), descarta las estrellas
// que ya están en stars_15pc.json (AT-HYG y anfitrionas añadidas), se queda con las
// MAX_STARS más brillantes en G y exporta un binario compacto para la capa de fondo.
//
// Distancia = 1000 / paralaje (pc), sin modelos bayesianos (regla D-014).
//
// === Formato de public/data/gaia-1m.bin (little-endian) ===
// Encabezado, 16 bytes:
//   0  4 bytes  firma ASCII "HGAI"
//   4  uint32   versión del formato (FORMAT_VERSION)
//   8  uint32   N, número de estrellas
//  12  uint32   reservado (0)
// Cuerpo, en bloques para poder leerlo con vistas tipadas sin copiar:
//  16          float32 × 3N   x, y, z intercalados (pc, ecuatorial J2000, Sol en el origen)
//  16 + 12N    uint8 × N      magnitud absoluta G cuantizada
//  16 + 13N    uint8 × N      BP−RP cuantizado
// Total: 16 + 14N bytes. Las estrellas van ordenadas por G aparente (más brillante primero),
// así que los primeros K registros son siempre las K más brillantes del archivo.
//
// Cuantización de la magnitud absoluta G (M = G + 5·log10(paralaje_mas) − 10):
//   byte = round((M − M_MIN) / M_STEP), recortado a 0..255
//   M    = M_MIN + byte · M_STEP          (M_MIN = −12, M_STEP = 0,125 → cubre −12 … +19,875)
// Cuantización de BP−RP:
//   byte = round((BP−RP − C_MIN) / C_STEP), recortado a 0..254
//   BP−RP = C_MIN + byte · C_STEP         (C_MIN = −1, C_STEP = 0,035 → cubre −1 … +7,89)
//   byte = 255 significa «sin color en Gaia».

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { parse } from 'csv-parse/sync';

// === CONFIGURACIÓN ===
const RAW_PATH = './data/raw/gaia/gaia_dr3_1m.csv.gz';
const ATHYG_PATH = './data/raw/hyglike_from_athyg_v32.csv';
const STARS_PATH = './data/processed/stars_15pc.json';
const IDENTITY_PATH = './data/catalog/star_identity.json';
const HOSTS_PATH = './data/catalog/added_hosts.json';
const SYSTEMS_PATH = './data/processed/star_systems.json';
const OUTPUT_PATH = './public/data/gaia-1m.bin';

const MAX_STARS = 1_000_000;
const FORMAT_VERSION = 1;
const HEADER_BYTES = 16;

// Cruce por posición: radio y época
const MATCH_RADIUS_ARCSEC = 3;
const GAIA_EPOCH = 2016.0;    // ref_epoch de gaia_source en DR3
const CATALOG_EPOCH = 2000.0; // AT-HYG y stars_15pc.json están en J2000
// Tolerancias de magnitud, las mismas de scripts/catalog/cruzar_gaia_posicion.py
const TOL_MAG = 1.0;          // |V(Gaia) − V(AT-HYG)| con color
const G_MINUS_V_MIN = -1.5;   // sin color: G puede ser hasta 1,5 mag más brillante que V…
const G_MINUS_V_MAX = 0.5;    // …o 0,5 mag más débil
// Compañeras que Hoshi ya dibuja desde star_systems.json (las que no son una estrella propia)
const COMP_SEP_FACTOR = 1.5;  // radio de búsqueda = 1,5 × separación máxima del sistema (UA)…
const COMP_SEP_MARGIN_ARCSEC = 3; // …más este margen por la posición del catálogo
const COMP_TOL_PLX = 0.15;    // paralaje de Gaia a ±15 % de la de la estrella principal
const COMP_TOL_MAG = 1.5;     // |V(Gaia) − V de la compañera| cuando el sistema la trae

// Escalas de cuantización (ver encabezado)
const M_MIN = -12;
const M_STEP = 0.125;
const C_MIN = -1;
const C_STEP = 0.035;
const C_NONE = 255;

const DEG = Math.PI / 180;
const MAS_TO_DEG = 1 / 3.6e6;


// === 1. Estrellas que ya tiene Hoshi ===
// stars_15pc.json no guarda el source_id de Gaia; se recupera de star_identity.json
// (AT-HYG ↔ Gaia vía HIP o posición) y de added_hosts.json (anfitrionas de exoplanetas).
for (const p of [RAW_PATH, ATHYG_PATH, STARS_PATH, IDENTITY_PATH, HOSTS_PATH, SYSTEMS_PATH]) {
  if (!fs.existsSync(p)) {
    console.error(`❌ Falta ${p}`);
    process.exit(1);
  }
}
const hoshiStars = JSON.parse(fs.readFileSync(STARS_PATH, 'utf-8'));
const gaiaById = new Map();
for (const s of JSON.parse(fs.readFileSync(IDENTITY_PATH, 'utf-8')).stars) if (s.gaia) gaiaById.set(s.i, s.gaia);
for (const s of JSON.parse(fs.readFileSync(HOSTS_PATH, 'utf-8')).stars) if (s.gaia) gaiaById.set(s.i, s.gaia);

const knownSourceIds = new Set();
const withoutId = [];
for (const s of hoshiStars) {
  const sid = gaiaById.get(s.i);
  if (sid) knownSourceIds.add(sid);
  else if (s.d > 0) withoutId.push(s); // el Sol (d = 0) no cuenta
}
console.log(`✓ Estrellas en Hoshi: ${hoshiStars.length.toLocaleString()}; con source_id de Gaia: ${knownSourceIds.size.toLocaleString()}; sin él: ${withoutId.length}`);

// Para las que no tienen source_id se busca su posición J2000 y su movimiento propio en AT-HYG.
// Las anfitrionas añadidas sin Gaia no están en AT-HYG: se usa la dirección de x, y, z sin movimiento propio.
const athyg = new Map();
for (const r of parse(fs.readFileSync(ATHYG_PATH, 'utf-8'), { columns: true, skip_empty_lines: true })) {
  athyg.set(parseInt(r.id), r);
}
const num = v => (v === undefined || v === '' ? null : Number(v));
function positionAtGaiaEpoch(s) {
  const r = athyg.get(s.i);
  let ra, dec, pmra = 0, pmdec = 0, v;
  if (r) {
    ra = Number(r.ra) * 15;
    dec = Number(r.dec);
    pmra = num(r.pmra) ?? 0;   // mas/año, ya multiplicado por cos(dec) como en Hipparcos
    pmdec = num(r.pmdec) ?? 0;
    v = num(r.mag);
  } else {
    ra = ((Math.atan2(s.y, s.x) / DEG) + 360) % 360;
    dec = Math.asin(s.z / s.d) / DEG;
    v = s.m + 5 * Math.log10(s.d) - 5;
  }
  // Llevar la posición a la época de Gaia (2016,0) con el movimiento propio.
  const dt = GAIA_EPOCH - CATALOG_EPOCH;
  const cosDec = Math.max(Math.cos(dec * DEG), 1e-9);
  return { i: s.i, ra: ra + (pmra * dt * MAS_TO_DEG) / cosDec, dec: dec + pmdec * dt * MAS_TO_DEG, v };
}
const probes = withoutId.map(positionAtGaiaEpoch);


// === 2. Leer la descarga cruda (CSV comprimido, ordenado por G) ===
// Se lee línea a línea: son ~1,15 millones de filas sin comillas ni comas internas.
const rows = [];
let header = null;
const lines = readline.createInterface({ input: fs.createReadStream(RAW_PATH).pipe(zlib.createGunzip()), crlfDelay: Infinity });
for await (const line of lines) {
  if (!line) continue;
  const f = line.split(',');
  if (!header) {
    header = Object.fromEntries(f.map((name, k) => [name, k]));
    continue;
  }
  rows.push({
    sid: f[header.source_id],
    ra: Number(f[header.ra]),
    dec: Number(f[header.dec]),
    plx: Number(f[header.parallax]),
    pmra: Number(f[header.pmra]) || 0,
    pmdec: Number(f[header.pmdec]) || 0,
    g: Number(f[header.phot_g_mean_mag]),
    bprp: f[header.bp_rp] === '' ? null : Number(f[header.bp_rp]),
  });
}
console.log(`✓ Filas de Gaia leídas: ${rows.length.toLocaleString()}`);


// === 3. Duplicados ===
// 3a. Por source_id.
const duplicate = new Uint8Array(rows.length);
let dupById = 0;
rows.forEach((r, k) => {
  if (knownSourceIds.has(r.sid)) { duplicate[k] = 1; dupById++; }
});

// 3b. Por posición (solo las estrellas de Hoshi sin source_id): a menos de MATCH_RADIUS_ARCSEC
// en la época 2016,0 y con magnitud parecida. V de Gaia según Riello et al. (2021), tabla C.2.
function vFromGaia(g, c) {
  if (c === null) return null;
  return g - (-0.02704 + 0.01424 * c - 0.2156 * c * c + 0.01426 * c ** 3);
}
const byDec = rows.map((_, k) => k).sort((a, b) => rows[a].dec - rows[b].dec);
const decs = Float64Array.from(byDec, k => rows[k].dec);
function lowerBound(arr, value) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < value) lo = mid + 1; else hi = mid;
  }
  return lo;
}
const radiusDeg = MATCH_RADIUS_ARCSEC / 3600;
let dupByPosition = 0;
for (const p of probes) {
  if (p.v === null || !Number.isFinite(p.v)) continue;
  for (let j = lowerBound(decs, p.dec - radiusDeg); j < decs.length && decs[j] <= p.dec + radiusDeg; j++) {
    const k = byDec[j], r = rows[k];
    if (duplicate[k]) continue;
    const dra = (((r.ra - p.ra + 540) % 360) - 180) * Math.cos(p.dec * DEG);
    if (Math.hypot(dra, r.dec - p.dec) > radiusDeg) continue;
    const vg = vFromGaia(r.g, r.bprp);
    const ok = vg !== null ? Math.abs(vg - p.v) <= TOL_MAG : (r.g - p.v >= G_MINUS_V_MIN && r.g - p.v <= G_MINUS_V_MAX);
    if (ok) { duplicate[k] = 1; dupByPosition++; }
  }
}

// 3c. Compañeras de binarias. star_systems.json dibuja compañeras que no están en stars_15pc.json
// (las que no tienen «cid»), a partir de WDS, ORB6 y MSC. Las «hidden» no se dibujan y no cuentan. Si Gaia las resuelve aparecerían dobles.
// Se descarta toda estrella de Gaia que esté alrededor de la principal dentro de la separación del
// sistema (rho, o a·(1 + e) para las órbitas, ambas en UA), con la misma paralaje y, si el sistema
// trae la magnitud V de la compañera, con un brillo compatible.
const hoshiById = new Map(hoshiStars.map(s => [s.i, s]));
let dupByCompanion = 0;
for (const [id, system] of Object.entries(JSON.parse(fs.readFileSync(SYSTEMS_PATH, 'utf-8')))) {
  const host = hoshiById.get(Number(id));
  // También cuentan las compañeras que sí son estrella de Hoshi pero no tienen fuente Gaia
  // propia (sin enlace, o enlazadas a la misma fuente que la principal, como p Eridani A y B).
  const hostSid = gaiaById.get(Number(id));
  const comps = (system.comps ?? []).filter(c => c.cid === undefined || !gaiaById.get(c.cid) || gaiaById.get(c.cid) === hostSid);
  if (!host || !(host.d > 0) || comps.length === 0) continue;
  const maxSepAu = Math.max(...comps.map(c => Math.max(c.rho ?? 0, (c.a ?? 0) * (1 + (c.e ?? 0)))));
  if (!(maxSepAu > 0)) continue;
  const compV = comps.map(c => c.v).filter(Number.isFinite);
  const p = positionAtGaiaEpoch(host);
  const hostPlx = 1000 / host.d;
  const rDeg = (COMP_SEP_FACTOR * maxSepAu / host.d + COMP_SEP_MARGIN_ARCSEC) / 3600;
  for (let j = lowerBound(decs, p.dec - rDeg); j < decs.length && decs[j] <= p.dec + rDeg; j++) {
    const k = byDec[j], r = rows[k];
    if (duplicate[k]) continue;
    const dra = (((r.ra - p.ra + 540) % 360) - 180) * Math.cos(p.dec * DEG);
    if (Math.hypot(dra, r.dec - p.dec) > rDeg) continue;
    if (Math.abs(r.plx - hostPlx) / hostPlx > COMP_TOL_PLX) continue;
    const vg = vFromGaia(r.g, r.bprp);
    if (compV.length && vg !== null && Math.min(...compV.map(v => Math.abs(vg - v))) > COMP_TOL_MAG) continue;
    duplicate[k] = 1;
    dupByCompanion++;
  }
}
const dupTotal = dupById + dupByPosition + dupByCompanion;
console.log(`✓ Duplicados descartados: ${dupTotal.toLocaleString()} (${dupById.toLocaleString()} por source_id, ${dupByPosition} por posición, ${dupByCompanion} compañeras de binarias)`);


// === 4. Quedarse con las MAX_STARS más brillantes ===
// La descarga viene ordenada por G; se reordena por si acaso, con el source_id como desempate.
const kept = rows.filter((_, k) => !duplicate[k]);
kept.sort((a, b) => a.g - b.g || (a.sid < b.sid ? -1 : 1));
if (kept.length < MAX_STARS) console.warn(`⚠ Solo quedan ${kept.length.toLocaleString()} estrellas (< ${MAX_STARS.toLocaleString()})`);
const stars = kept.slice(0, MAX_STARS);
const n = stars.length;


// === 5. Escribir el binario ===
const buffer = Buffer.alloc(HEADER_BYTES + 14 * n);
buffer.write('HGAI', 0, 'ascii');
buffer.writeUInt32LE(FORMAT_VERSION, 4);
buffer.writeUInt32LE(n, 8);
buffer.writeUInt32LE(0, 12);
const posOffset = HEADER_BYTES, magOffset = HEADER_BYTES + 12 * n, colorOffset = HEADER_BYTES + 13 * n;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const distances = new Float64Array(n);
stars.forEach((s, k) => {
  const dist = 1000 / s.plx;
  distances[k] = dist;
  // Posición J2000: se deshace el movimiento propio de 2016,0 a 2000,0 (como en added_hosts.json).
  const dt = CATALOG_EPOCH - GAIA_EPOCH;
  const decDeg = s.dec + s.pmdec * dt * MAS_TO_DEG;
  const raDeg = s.ra + (s.pmra * dt * MAS_TO_DEG) / Math.max(Math.cos(s.dec * DEG), 1e-9);
  // Mismo cálculo que process_stars.js: ecuatorial con el Sol en el origen.
  const ra = raDeg * DEG, dec = decDeg * DEG;
  buffer.writeFloatLE(dist * Math.cos(dec) * Math.cos(ra), posOffset + 12 * k);
  buffer.writeFloatLE(dist * Math.cos(dec) * Math.sin(ra), posOffset + 12 * k + 4);
  buffer.writeFloatLE(dist * Math.sin(dec), posOffset + 12 * k + 8);

  const absMag = s.g + 5 * Math.log10(s.plx) - 10;
  buffer[magOffset + k] = clamp(Math.round((absMag - M_MIN) / M_STEP), 0, 255);
  buffer[colorOffset + k] = s.bprp === null ? C_NONE : clamp(Math.round((s.bprp - C_MIN) / C_STEP), 0, 254);
});

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, buffer);
const gzipped = zlib.gzipSync(buffer, { level: 9 }).length;
console.log(`✓ Guardado: ${OUTPUT_PATH} (${(buffer.length / 1048576).toFixed(2)} MB; con gzip ${(gzipped / 1048576).toFixed(2)} MB)`);


// === Resumen para verificar ===
const sortedD = Float64Array.from(distances).sort();
const beyondKpc = sortedD.length - lowerBound(sortedD, 1000.0000001);
console.log(`  G de corte: ${stars[n - 1].g.toFixed(3)} (la más brillante, ${stars[0].g.toFixed(3)})`);
console.log(`  Distancias: ${sortedD[0].toFixed(2)} – ${sortedD[n - 1].toFixed(0)} pc; mediana ${sortedD[n >> 1].toFixed(0)} pc`);
console.log(`  A más de 1 kpc: ${beyondKpc.toLocaleString()} (${(100 * beyondKpc / n).toFixed(1)} %)`);
console.log(`  Sin BP−RP: ${stars.filter(s => s.bprp === null).length.toLocaleString()}`);
