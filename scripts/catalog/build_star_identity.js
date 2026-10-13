// scripts/catalog/build_star_identity.js
// Unifica la identidad de las estrellas de Hoshi con Gaia DR3, SIMBAD y el
// NASA Exoplanet Archive. No modifica el catálogo de estrellas: produce tablas
// de enlace en data/catalog/ para que otros generadores las consuman.
// Uso: node scripts/catalog/build_star_identity.js
// Entradas descargadas por scripts/catalog/descargar_gaia.py y descargar_simbad.py.

import fs from 'node:fs';
import { parse } from 'csv-parse/sync';

const ATHYG_CSV = './data/raw/hyglike_from_athyg_v32.csv';
const STARS_JSON = './data/processed/stars_15pc.json';
const GAIA_HIP_CSV = './data/raw/gaia/gaia_dr3_hip.csv';
const GAIA_HOSTS_CSV = './data/raw/gaia/gaia_dr3_exoplanet_hosts.csv';
const SIMBAD_CSV = './data/raw/simbad/simbad_exoplanet_hosts.csv';
const SIMBAD_MAP_CSV = './data/raw/simbad/simbad_exoplanet_hosts_mapa.csv';
const NASA_IDS_CSV = './data/raw/exoplanets/nasa_pscomppars_ids.csv';
const SYSTEMS_JSON = './data/exoplanets/exoplanet_systems.json';
const OUT_DIR = './data/catalog';

// Paralaje fiable: error relativo menor al 10 %.
const MAX_PARALLAX_REL_ERROR = 0.1;
// Discrepancia de distancia que se informa para revisión (no se corrige aquí).
const DISTANCE_FLAG = 0.1;
// Umbral habitual de RUWE para astrometría perturbada (posible binaria no resuelta).
const RUWE_BINARY = 1.4;

const read = file => parse(fs.readFileSync(file, 'utf8'), { columns: true, skip_empty_lines: true, relax_quotes: true });
const num = v => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const sig = (v, digits = 5) => v === null ? null : Number(v.toPrecision(digits));
const gaiaId = s => (s || '').replace(/^Gaia DR3\s*/i, '').trim() || null;
// SIMBAD rellena con espacios ("HD   6860"); se compacta solo para mostrar.
const tidy = s => (s || '').replace(/\s+/g, ' ').trim();

function astrometry(g) {
  if (!g) return null;
  return {
    plx: sig(num(g.parallax)), plxE: sig(num(g.parallax_error), 3),
    pmra: sig(num(g.pmra)), pmdec: sig(num(g.pmdec)), rv: sig(num(g.radial_velocity), 4),
    G: sig(num(g.phot_g_mean_mag), 4), bpRp: sig(num(g.bp_rp), 4),
    ruwe: sig(num(g.ruwe), 3), nss: num(g.non_single_star),
    teff: sig(num(g.teff_gspphot), 4), r: sig(num(g.radius_gspphot), 4), dPhot: sig(num(g.distance_gspphot), 5),
  };
}

function parallaxDistance(a) {
  if (!a || !a.plx || a.plx <= 0 || !a.plxE || a.plxE / a.plx > MAX_PARALLAX_REL_ERROR) return null;
  return 1000 / a.plx;
}


// === 1. Catálogo de Hoshi ===
const hoshi = new Map(JSON.parse(fs.readFileSync(STARS_JSON, 'utf8'))
  .filter(s => [s.x, s.y, s.z].every(Number.isFinite)).map(s => [s.i, s]));
const athyg = read(ATHYG_CSV).filter(r => hoshi.has(Number(r.id)));
console.log(`✓ Estrellas de Hoshi con fila AT-HYG: ${athyg.length}`);


// === 2. Gaia DR3 por HIP (hipparcos2_best_neighbour) ===
const gaiaByHip = new Map(), gaiaBySource = new Map();
for (const g of read(GAIA_HIP_CSV)) {
  gaiaByHip.set(g.hip, g);
  gaiaBySource.set(g.source_id, g);
}
for (const g of read(GAIA_HOSTS_CSV)) if (!gaiaBySource.has(g.source_id)) gaiaBySource.set(g.source_id, g);


// === 3. Tabla de identidad de las estrellas de Hoshi ===
const stars = [];
const athygByGaia = new Map();
const distanceFlags = [], binaryCandidates = [];
for (const r of athyg) {
  const id = Number(r.id);
  const g = r.hip ? gaiaByHip.get(r.hip) : null;
  const a = astrometry(g);
  const rec = {
    i: id,
    gaia: g ? g.source_id : null,
    hip: r.hip ? Number(r.hip) : null,
    hd: r.hd ? Number(r.hd) : null,
    hr: r.hr ? Number(r.hr) : null,
    gj: r.gl || null,
    n: r.proper || null,
    bf: r.bf || null,
    // Calidad del enlace HIP→Gaia según el propio Gaia.
    gq: g ? { sep: sig(num(g.angular_distance), 3), vecinos: num(g.number_of_neighbours) } : null,
    g: a,
  };
  stars.push(rec);
  if (rec.gaia) athygByGaia.set(rec.gaia, id);
  const dGaia = parallaxDistance(a);
  const dHoshi = num(r.dist);
  if (dGaia && dHoshi && Math.abs(dHoshi - dGaia) / dGaia > DISTANCE_FLAG) {
    distanceFlags.push({ i: id, n: r.proper || r.gl || (r.hip && `HIP ${r.hip}`), dHoshi, dGaia: sig(dGaia, 5), fuente: r.dist_src });
  }
  if (a && ((a.ruwe ?? 0) > RUWE_BINARY || (a.nss ?? 0) > 0)) binaryCandidates.push(id);
}


// === 4. SIMBAD: alias por anfitrión ===
const simbadByQuery = new Map();
for (const row of read(SIMBAD_CSV)) {
  const q = row.query_id;
  if (!simbadByQuery.has(q)) simbadByQuery.set(q, { main: tidy(row.main_id), otype: row.otype || null, sp: row.sp_type || null, alias: new Set() });
  simbadByQuery.get(q).alias.add(tidy(row.alias));
}
const simbadByHost = new Map(read(SIMBAD_MAP_CSV).filter(m => m.query_id).map(m => [m.hostname, simbadByQuery.get(m.query_id)]));

// Extraer identificadores de catálogo de la lista de alias de SIMBAD.
function aliasIds(alias) {
  const ids = {};
  for (const a of alias) {
    let m;
    if ((m = a.match(/^HIP (\d+)$/))) ids.hip = Number(m[1]);
    else if ((m = a.match(/^HD (\d+)$/))) ids.hd = Number(m[1]);
    else if ((m = a.match(/^Gaia DR3 (\d+)$/))) ids.gaia = m[1];
    else if ((m = a.match(/^(GJ|Gl) (.+)$/))) ids.gj = ids.gj || `GJ ${m[2]}`;
    else if ((m = a.match(/^NAME (.+)$/))) ids.nombre = ids.nombre || m[1];
  }
  return ids;
}


// === 5. Anfitriones de exoplanetas: unir NASA, Gaia, SIMBAD y Hoshi ===
const systems = new Map(JSON.parse(fs.readFileSync(SYSTEMS_JSON, 'utf8')).systems.map(s => [s.h, s]));
const nasaHosts = new Map();
for (const r of read(NASA_IDS_CSV)) if (!nasaHosts.has(r.hostname)) nasaHosts.set(r.hostname, r);

const athygByHip = new Map(athyg.filter(r => r.hip).map(r => [Number(r.hip), Number(r.id)]));
const athygByHd = new Map(athyg.filter(r => r.hd).map(r => [Number(r.hd), Number(r.id)]));

const hosts = [];
const conflicts = [];
const newMatches = [];
for (const [host, r] of nasaHosts) {
  const sys = systems.get(host);
  const sb = simbadByHost.get(host) || null;
  const ids = sb ? aliasIds(sb.alias) : {};
  const gaia = gaiaId(r.gaia_dr3_id) || ids.gaia || null;
  // Enlaces candidatos a una estrella de Hoshi, del más fiable al menos fiable.
  const viaGaia = gaia ? athygByGaia.get(gaia) : undefined;
  const viaSimbadHip = ids.hip ? athygByHip.get(ids.hip) : undefined;
  const viaSimbadHd = ids.hd ? athygByHd.get(ids.hd) : undefined;
  const viaCruce = sys && sys.i !== null ? sys.i : undefined;
  const candidates = [['gaia', viaGaia], ['simbad-hip', viaSimbadHip], ['simbad-hd', viaSimbadHd], ['cruce', viaCruce]]
    .filter(([, v]) => v !== undefined);
  const distinct = [...new Set(candidates.map(([, v]) => v))];
  // Componentes (HD 41004 A/B) pueden compartir HIP/HD: el conflicto se informa, no se resuelve por nombre.
  if (distinct.length > 1) conflicts.push({ host, candidatos: Object.fromEntries(candidates) });
  const [method, i] = candidates[0] || [null, null];
  if (i !== null && viaCruce === undefined) newMatches.push({ host, i, method });
  hosts.push({
    h: host,
    i,                                  // estrella de Hoshi (null: no está en el catálogo)
    via: method,
    gaia,
    tic: r.tic_id || null,
    hip: ids.hip ?? (r.hip_name ? Number(r.hip_name.replace(/\D/g, '')) : null),
    hd: ids.hd ?? null,
    gj: ids.gj ?? null,
    simbad: sb ? { main: sb.main, otype: sb.otype, sp: sb.sp } : null,
    alias: sb ? [...sb.alias].sort() : [],
    g: astrometry(gaia ? gaiaBySource.get(gaia) : null),
    ns: num(r.sy_snum), np: num(r.sy_pnum),
  });
}


// === 6. Escribir ===
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(`${OUT_DIR}/star_identity.json`, JSON.stringify({
  meta: {
    descripcion: 'Identidad de cada estrella de Hoshi (ID AT-HYG) con Gaia DR3 vía HIP y astrometría Gaia',
    fuentes: ['AT-HYG v3.2', 'Gaia DR3 hipparcos2_best_neighbour + gaia_source + astrophysical_parameters'],
    nota: 'Posiciones Gaia en época 2016.0; no reemplazan las del catálogo.',
  },
  stars,
}));
fs.writeFileSync(`${OUT_DIR}/exoplanet_host_identity.json`, JSON.stringify({
  meta: { descripcion: 'Anfitriones de exoplanetas unificados: NASA + Gaia DR3 + SIMBAD + estrella de Hoshi', fuentes: ['NASA pscomppars', 'Gaia DR3', 'SIMBAD'] },
  hosts,
}));
const withGaia = stars.filter(s => s.gaia).length;
const report = {
  generado: new Date().toISOString(),
  estrellasHoshi: stars.length,
  conGaiaPorHip: withGaia,
  sinGaia: stars.length - withGaia,
  enlaceHipGaiaDudoso: stars.filter(s => s.gq && (s.gq.vecinos > 1 || s.gq.sep > 1)).length,
  distanciaDiscrepante: { umbral: DISTANCE_FLAG, total: distanceFlags.length,
    porFuente: distanceFlags.reduce((o, f) => ({ ...o, [f.fuente || '?']: (o[f.fuente || '?'] || 0) + 1 }), {}),
    muestra: distanceFlags.sort((a, b) => a.dGaia - b.dGaia).slice(0, 40) },
  candidatasBinariaGaia: { criterio: `RUWE > ${RUWE_BINARY} o non_single_star > 0`, total: binaryCandidates.length },
  anfitriones: {
    total: hosts.length,
    enHoshi: hosts.filter(h => h.i !== null).length,
    porVia: hosts.reduce((o, h) => ({ ...o, [h.via || 'ninguna']: (o[h.via || 'ninguna'] || 0) + 1 }), {}),
    conSimbad: hosts.filter(h => h.simbad).length,
    conGaia: hosts.filter(h => h.gaia).length,
    nuevosFrenteAlCruce: newMatches,
    conflictos: conflicts,
  },
};
fs.writeFileSync(`${OUT_DIR}/catalog_report.json`, JSON.stringify(report, null, 2));
console.log(`✓ Identidad: ${stars.length} estrellas, ${withGaia} con Gaia DR3`);
console.log(`✓ Anfitriones: ${hosts.length}; en Hoshi ${report.anfitriones.enHoshi}; nuevos ${newMatches.length}; conflictos ${conflicts.length}`);
console.log(`✓ Distancias Hoshi vs Gaia > ${DISTANCE_FLAG * 100} %: ${distanceFlags.length}; candidatas a binaria: ${binaryCandidates.length}`);
