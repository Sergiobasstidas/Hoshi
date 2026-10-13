// scripts/exoplanets/process_exoplanets.js
// Lee la tabla compuesta del NASA Exoplanet Archive (pscomppars), cruza cada
// anfitrión con el catálogo AT-HYG de Hoshi y exporta los sistemas planetarios
// en el mismo marco que las estrellas: pc, ecuatorial J2000, Sol en el origen.
// Uso: node scripts/exoplanets/process_exoplanets.js
// Ver docs/exoplanets/SISTEMAS_PLANETARIOS.md antes de cambiar el formato.

import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';

const NASA_CSV = './data/raw/exoplanets/nasa_pscomppars.csv';
const ATHYG_CSV = './data/raw/hyglike_from_athyg_v32.csv';
const STARS_JSON = './data/processed/stars_15pc.json';
const OUTPUT_PATH = './data/exoplanets/exoplanet_systems.json';
const REPORT_PATH = './data/exoplanets/crossmatch_report.json';

// Época de las coordenadas del archivo (Gaia DR2/DR3) frente a J2000 de AT-HYG.
const EPOCH_GAP_YR = 16;
const BASE_TOLERANCE_ARCSEC = 5;
const DISTANCE_TOLERANCE = 0.25;
// Algunas enanas débiles de AT-HYG conservan posiciones de catálogos antiguos
// (WD 0806-661 está desplazada 78 años de movimiento propio). Para ellas se admite
// un radio mayor solo si la distancia coincide casi exactamente y el desfase
// apunta en la dirección del movimiento propio (no un compañero de sistema).
const MIN_PM_ALIGNMENT = 0.9;
const WIDE_EPOCH_GAP_YR = 100;
const WIDE_DISTANCE_TOLERANCE = 0.03;

const num = v => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
// Redondeo a cifras significativas para aligerar el JSON sin perder precisión útil.
const sig = (v, digits = 5) => v === null ? null : Number(v.toPrecision(digits));
const maxError = (plus, minus) => num(plus) === null && num(minus) === null ? null : Math.max(Math.abs(num(plus) ?? 0), Math.abs(num(minus) ?? 0));
const normId = s => (s || '').replace(/\s+/g, ' ').trim().toUpperCase();
// AT-HYG escribe "Gl 551", "Gl 667C" y "GJ 1001"; la NASA usa "GJ 667 C" o "Gliese 12".
// La clave ignora espacios para que el sufijo de componente coincida.
const normGliese = s => normId(s).replace(/^(GLIESE|GL|GJ) ?/, 'GJ').replace(/ /g, '');
// pscomppars solo marca como calculados radio y masa (relación masa-radio);
// semieje, excentricidad e inclinación no traen esa marca aunque se deriven.
const isCalculated = ref => /CALCULATED|Calculated Value/i.test(ref || '');
// Algunos tipos espectrales traen entidades HTML, p. ej. "M4.0&plusmn;1.0 V".
const decodeHtml = s => s && s.replace(/&plusmn;/g, '±').replace(/&amp;/g, '&');

function radecToXyz(raDeg, decDeg, distPc) {
  const ra = raDeg * Math.PI / 180, dec = decDeg * Math.PI / 180;
  return [distPc * Math.cos(dec) * Math.cos(ra), distPc * Math.cos(dec) * Math.sin(ra), distPc * Math.sin(dec)];
}

function separationArcsec(ra1, dec1, ra2, dec2) {
  const r = Math.PI / 180;
  const s = Math.sin((dec2 - dec1) * r / 2) ** 2
    + Math.cos(dec1 * r) * Math.cos(dec2 * r) * Math.sin((ra2 - ra1) * r / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(s))) / r * 3600;
}


// === 1. Catálogo de Hoshi: solo estrellas presentes en el JSON procesado ===
const hoshiIds = new Set(JSON.parse(fs.readFileSync(STARS_JSON, 'utf8'))
  .filter(s => [s.x, s.y, s.z].every(Number.isFinite)).map(s => s.i));
const athyg = parse(fs.readFileSync(ATHYG_CSV, 'utf8'), { columns: true, skip_empty_lines: true })
  .filter(r => hoshiIds.has(Number(r.id)));

const byHip = new Map(), byHd = new Map(), byGj = new Map(), byName = new Map();
const add = (map, key, row) => { if (key) map.set(key, [...(map.get(key) || []), row]); };
// Celdas de 1° para la búsqueda posicional.
const cells = new Map();
const cellKey = (ra, dec) => `${Math.floor(ra)}:${Math.floor(dec + 90)}`;
for (const r of athyg) {
  r.raDeg = Number(r.ra) * 15; r.decDeg = Number(r.dec);
  add(byHip, r.hip && `HIP ${r.hip}`, r);
  add(byHd, r.hd && `HD ${r.hd}`, r);
  add(byGj, r.gl && normGliese(r.gl), r);
  add(byName, r.proper && normId(r.proper), r);
  add(cells, cellKey(r.raDeg, r.decDeg), r);
}


// === 2. Tabla de la NASA ===
// Las columnas *str traen HTML con comillas sin escapar dentro de campos entrecomillados.
const planets = parse(fs.readFileSync(NASA_CSV, 'utf8'), { columns: true, skip_empty_lines: true, comment: '#', relax_quotes: true });
console.log(`✓ Planetas en pscomppars: ${planets.length}`);


// === 3. Cruce de anfitriones ===
// Orden: HIP → HD → GJ → nombre propio → posición. Un identificador que apunta a
// varias filas AT-HYG (componentes) se desambigua por posición; nunca por parecido de nombre.
function nearest(rows, ra, dec, tol) {
  let best = null;
  for (const r of rows) {
    const sep = separationArcsec(ra, dec, r.raDeg, r.decDeg);
    if (sep <= tol && (!best || sep < best.sep)) best = { row: r, sep };
  }
  return best;
}

// Coseno entre el desfase (NASA − AT-HYG) y el movimiento propio de la estrella.
function pmAlignment(r, ra, dec) {
  const east = ((ra - r.raDeg + 540) % 360 - 180) * Math.cos(dec * Math.PI / 180);
  const north = dec - r.decDeg;
  const pmra = num(r.pmra) || 0, pmdec = num(r.pmdec) || 0;
  const norm = Math.hypot(east, north) * Math.hypot(pmra, pmdec);
  return norm > 0 ? (east * pmra + north * pmdec) / norm : 0;
}

function pmTolerance(r, years) {
  const pm = Math.hypot(num(r.pmra) || 0, num(r.pmdec) || 0) / 1000;
  return BASE_TOLERANCE_ARCSEC + pm * years;
}

function matchHost(p) {
  const ra = num(p.ra), dec = num(p.dec), dist = num(p.sy_dist);
  const keys = [
    ['hip', byHip, normId(p.hip_name)],
    ['hd', byHd, normId(p.hd_name)],
    ['gj', byGj, normGliese(p.hostname)],
    // "GJ 3473" en la NASA designa a la primaria que AT-HYG escribe "GJ 3473A".
    ['gj', byGj, /^(GLIESE|GL|GJ) ?\d+$/i.test(p.hostname.trim()) ? `${normGliese(p.hostname)}A` : ''],
    ['nombre', byName, normId(p.hostname)],
  ];
  for (const [method, map, key] of keys) {
    const rows = key && map.get(key);
    if (!rows) continue;
    if (rows.length === 1 || ra === null) return { row: rows[0], method, sep: ra === null ? null : separationArcsec(ra, dec, rows[0].raDeg, rows[0].decDeg) };
    const hit = nearest(rows, ra, dec, 60);
    if (hit) return { ...hit, method };
  }
  if (ra === null || dec === null) return null;
  // Posicional: vecinos en celdas contiguas, tolerancia por movimiento propio y distancia compatible.
  const candidates = [];
  for (let dr = -2; dr <= 2; dr++) for (let dd = -2; dd <= 2; dd++) {
    const c = cells.get(cellKey((ra + dr + 360) % 360, dec + dd));
    if (c) candidates.push(...c);
  }
  const search = (years, distanceTolerance, method, aligned) => {
    let best = null;
    for (const r of candidates) {
      const sep = separationArcsec(ra, dec, r.raDeg, r.decDeg);
      if (sep > pmTolerance(r, years)) continue;
      if (aligned && pmAlignment(r, ra, dec) < MIN_PM_ALIGNMENT) continue;
      const d = num(r.dist);
      if (dist === null && distanceTolerance < DISTANCE_TOLERANCE) continue;
      if (dist !== null && d !== null && Math.abs(d - dist) / dist > distanceTolerance) continue;
      if (!best || sep < best.sep) best = { row: r, sep, method };
    }
    return best;
  };
  return search(EPOCH_GAP_YR, DISTANCE_TOLERANCE, 'posicion')
    || search(WIDE_EPOCH_GAP_YR, WIDE_DISTANCE_TOLERANCE, 'posicion-amplia', true);
}


// === 4. Agrupar por anfitrión y convertir campos ===
const flag = v => v === '1';
const systems = new Map();
for (const p of planets) {
  const host = p.hostname;
  if (!systems.has(host)) {
    const m = matchHost(p);
    const ra = num(p.ra), dec = num(p.dec), dist = num(p.sy_dist);
    const own = ra !== null && dec !== null && dist !== null ? radecToXyz(ra, dec, dist).map(v => sig(v, 7)) : null;
    systems.set(host, {
      h: host,
      i: m ? Number(m.row.id) : null,             // ID AT-HYG del anfitrión (null: no está en Hoshi)
      mm: m ? m.method : null,                   // método de cruce
      sep: m && m.sep !== null ? sig(m.sep, 3) : null, // separación angular al cruzar (″)
      // Posición: la de la estrella de Hoshi si se cruzó; si no, la del archivo.
      pos: m ? [Number(m.row.x), Number(m.row.y), Number(m.row.z)] : own,
      d: m ? sig(Number(m.row.dist), 7) : dist,
      dNasa: dist,
      // Astrometría y fotometría del archivo, para poder añadir el anfitrión si falta en Hoshi.
      ra, dec, pm: [num(p.sy_pmra), num(p.sy_pmdec)], v: num(p.sy_vmag),
      ns: num(p.sy_snum), np: num(p.sy_pnum),
      st: {
        sp: decodeHtml(p.st_spectype) || null, teff: sig(num(p.st_teff), 4), r: sig(num(p.st_rad), 4),
        // Incertidumbres publicadas (la mayor de las dos barras de error).
        teffE: sig(maxError(p.st_tefferr1, p.st_tefferr2), 3), rE: sig(maxError(p.st_raderr1, p.st_raderr2), 3),
        m: sig(num(p.st_mass), 4), logL: sig(num(p.st_lum), 4), met: sig(num(p.st_met), 3),
        age: sig(num(p.st_age), 3),
      },
      ids: { hip: p.hip_name || null, hd: p.hd_name || null, gaia: p.gaia_dr3_id || p.gaia_dr2_id || null, tic: p.tic_id || null },
      p: [],
    });
  }
  const calc = ['pl_rade', 'pl_bmasse'].filter(k => isCalculated(p[`${k}_reflink`]));
  systems.get(host).p.push({
    n: p.pl_name, l: p.pl_letter || null,
    a: sig(num(p.pl_orbsmax)),          // semieje mayor (UA)
    P: sig(num(p.pl_orbper), 8),        // período (días)
    e: sig(num(p.pl_orbeccen), 4),      // excentricidad (null: no medida)
    inc: sig(num(p.pl_orbincl), 4),     // inclinación respecto al cielo (°)
    w: sig(num(p.pl_orblper), 4),       // argumento del periastro (°)
    tp: sig(num(p.pl_orbtper), 10),     // tiempo de periastro (JD)
    t0: sig(num(p.pl_tranmid), 10),     // tránsito central (JD)
    r: sig(num(p.pl_rade), 4),          // radio (R⊕)
    m: sig(num(p.pl_bmasse), 4),        // masa o m·sen i (M⊕)
    mp: p.pl_bmassprov || null,         // Mass | Msini | M-R relationship...
    teq: sig(num(p.pl_eqt), 4), ins: sig(num(p.pl_insol), 4),
    dm: p.discoverymethod || null, y: num(p.disc_year),
    f: {
      tr: flag(p.tran_flag), rv: flag(p.rv_flag), im: flag(p.ima_flag), as: flag(p.ast_flag),
      ttv: flag(p.ttv_flag), cb: flag(p.cb_flag), ctv: flag(p.pl_controv_flag),
    },
    calc,                               // radio/masa estimados por el archivo (relación masa-radio)
  });
}

const out = [...systems.values()]
  .map(s => ({ ...s, p: s.p.sort((a, b) => (a.a ?? a.P ?? 0) - (b.a ?? b.P ?? 0)) }))
  .sort((a, b) => (a.d ?? Infinity) - (b.d ?? Infinity));


// === 5. Informe de cobertura ===
const all = out.flatMap(s => s.p);
const pct = n => `${n} (${(100 * n / all.length).toFixed(1)}%)`;
const has = k => all.filter(p => p[k] !== null).length;
const measured = (k, col) => all.filter(p => p[k] !== null && !p.calc.includes(col)).length;
const matched = out.filter(s => s.i !== null);
const report = {
  fuente: 'NASA Exoplanet Archive, tabla pscomppars',
  generado: new Date().toISOString(),
  sistemas: out.length, planetas: all.length,
  sistemasEnHoshi: matched.length,
  planetasEnHoshi: matched.reduce((n, s) => n + s.p.length, 0),
  // Un mismo ID AT-HYG puede recibir varios anfitriones (componentes no resueltos en Hoshi).
  idsCompartidos: Object.entries(matched.reduce((o, s) => ({ ...o, [s.i]: [...(o[s.i] || []), s.h] }), {}))
    .filter(([, hosts]) => hosts.length > 1).map(([id, hosts]) => `${id}: ${hosts.join(' / ')}`),
  distanciaDiscrepante: matched.filter(s => s.dNasa && Math.abs(s.d - s.dNasa) / s.dNasa > 0.2)
    .map(s => `${s.h}: Hoshi ${s.d} pc, NASA ${s.dNasa} pc`),
  metodoCruce: Object.fromEntries(['hip', 'hd', 'gj', 'nombre', 'posicion', 'posicion-amplia'].map(m => [m, out.filter(s => s.mm === m).length])),
  sinCruceDentroDe100pc: out.filter(s => s.i === null && s.d !== null && s.d <= 100).map(s => `${s.h} (${s.d.toFixed(1)} pc)`),
  multiplicidad: { anfitrionEnSistemaMultiple: out.filter(s => s.ns > 1).length, circumbinarios: out.filter(s => s.p.some(p => p.f.cb)).length },
  campos: {
    semiejeMayor: { presente: pct(has('a')) },
    periodo: { presente: pct(has('P')) },
    // e = 0 suele ser un valor fijado en el ajuste (órbita supuesta circular), no una medida.
    excentricidad: { presente: pct(has('e')), igualACero: pct(all.filter(p => p.e === 0).length) },
    inclinacion: { presente: pct(has('inc')), enTransito: pct(all.filter(p => p.inc !== null && p.f.tr).length) },
    orbita3DCompleta: 'Ω (nodo ascendente) no está en pscomppars: 0 planetas',
    argumentoPeriastro: { presente: pct(has('w')) },
    tiempoPeriastro: { presente: pct(has('tp')) },
    transitoCentral: { presente: pct(has('t0')) },
    radio: { presente: pct(has('r')), medido: pct(measured('r', 'pl_rade')) },
    masa: { presente: pct(has('m')), procedencia: Object.fromEntries(Object.entries(all.reduce((o, p) => ({ ...o, [p.mp]: (o[p.mp] || 0) + 1 }), {}))) },
    faseUtilizable: pct(all.filter(p => p.t0 !== null || p.tp !== null).length),
  },
};

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, JSON.stringify({
  meta: {
    fuente: 'https://exoplanetarchive.ipac.caltech.edu/ (pscomppars)',
    marco: 'pos en pc, ecuatorial J2000, Sol en el origen (igual que stars_15pc.json)',
    unidades: { a: 'UA', P: 'días', inc: '°', w: '°', tp: 'JD', t0: 'JD', r: 'R⊕', m: 'M⊕', teq: 'K', ins: 'S⊕' },
    nota: 'Sin longitud del nodo ascendente (Ω): la orientación 3D del plano orbital no está en la tabla.',
  },
  systems: out,
}));
fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

const sizeMB = (fs.statSync(OUTPUT_PATH).size / 1048576).toFixed(1);
console.log(`✓ Guardado: ${OUTPUT_PATH} (${sizeMB} MB)`);
console.log(`✓ Sistemas: ${out.length}; en Hoshi: ${matched.length} (${report.planetasEnHoshi} planetas)`);
console.log(`✓ Cruce: ${JSON.stringify(report.metodoCruce)}`);
