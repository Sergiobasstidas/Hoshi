// scripts/catalog/auditoria/fuentes.js
// Carga, sin red, todo lo que la auditoría cruza: el catálogo de Hoshi y cada fuente tal como está en data/raw,
// con índices por identificador y por posición (llevada a J2000 con su movimiento propio).
import fs from 'node:fs';
import zlib from 'node:zlib';
import { parse } from 'csv-parse/sync';
import { DISTANCIAS_CURADAS } from '../distancias_curadas.js';
import { indiceCns5 } from '../fusion.js';
import { aplicarEnlaces, leerEnlaces } from '../enlaces_registro.js';
import { leerGaiaRegistro } from '../gaia_local.js';

const gz = ruta => zlib.gunzipSync(fs.readFileSync(ruta)).toString('utf8');
const csv = texto => parse(texto, { columns: true, skip_empty_lines: true, relax_quotes: true });
export const num = v => (v === undefined || v === null || v === '' ? null : Number(v));
const RAD = Math.PI / 180;

// Lector rápido de CSV simple (sin comillas con comas): para los archivos de un millón de filas.
function filasSimples(texto, columnas) {
  const lineas = texto.split('\n');
  const cab = lineas[0].split(',');
  const idx = columnas.map(c => cab.indexOf(c));
  const salida = [];
  for (let k = 1; k < lineas.length; k++) {
    if (!lineas[k]) continue;
    const p = lineas[k].split(',');
    const fila = {};
    columnas.forEach((c, j) => { fila[c] = p[idx[j]]; });
    salida.push(fila);
  }
  return salida;
}

// Posición en J2000 (grados) desde una época con movimiento propio en mas/año.
export function aJ2000(ra, dec, pmra, pmdec, epoca) {
  const anos = 2000 - epoca;
  return { ra: ((ra + (pmra || 0) * anos / 3.6e6 / Math.cos(dec * RAD)) % 360 + 360) % 360, dec: dec + (pmdec || 0) * anos / 3.6e6 };
}

export function separacion(a, b) {
  const c = Math.sin(a.dec * RAD) * Math.sin(b.dec * RAD) + Math.cos(a.dec * RAD) * Math.cos(b.dec * RAD) * Math.cos((a.ra - b.ra) * RAD);
  return Math.acos(Math.min(1, Math.max(-1, c))) / RAD * 3600;
}

// Índice por celdas de 0,5° (en declinación) para buscar vecinos a pocos segundos de arco.
export class Cielo {
  constructor() { this.celdas = new Map(); }
  clave(ra, dec) { return `${Math.floor(ra * 2)}:${Math.floor((dec + 90) * 2)}`; }
  agregar(obj) { const k = this.clave(obj.j2000.ra, obj.j2000.dec); if (!this.celdas.has(k)) this.celdas.set(k, []); this.celdas.get(k).push(obj); }
  // Objetos a ≤ radio″ de pos, con su separación mínima entre J2000 y su época propia; ordenados por separación.
  cerca(pos, radio) {
    const salida = [];
    const ci = Math.floor(pos.ra * 2), cj = Math.floor((pos.dec + 90) * 2);
    const ancho = Math.abs(pos.dec) > 85 ? 720 : 1;
    for (let i = -ancho; i <= ancho; i++) for (let j = -1; j <= 1; j++) {
      const lista = this.celdas.get(`${((ci + i) % 720 + 720) % 720}:${cj + j}`);
      if (!lista) continue;
      for (const o of lista) {
        const s = Math.min(separacion(pos, o.j2000), o.nativa ? separacion(pos, o.nativa) : Infinity);
        if (s <= radio) salida.push({ o, sep: s });
      }
    }
    return salida.sort((a, b) => a.sep - b.sep);
  }
}

export async function cargarTodo() {
  const t0 = Date.now();
  const log = m => console.log(`  ${((Date.now() - t0) / 1000).toFixed(1)} s · ${m}`);
  // --- Hoshi ---
  const estrellas = JSON.parse(fs.readFileSync('data/processed/stars_15pc.json', 'utf8'));
  for (const s of estrellas) {
    const r = Math.hypot(s.x, s.y, s.z);
    s.ra = r > 0 ? (Math.atan2(s.y, s.x) / RAD + 360) % 360 : 0;
    s.dec = r > 0 ? Math.asin(s.z / r) / RAD : 0;
    s.V = s.d > 0 && Number.isFinite(s.m) ? s.m + 5 * Math.log10(s.d / 10) : null;
  }
  const porId = new Map(estrellas.map(s => [s.i, s]));
  const registro = aplicarEnlaces(new Map(csv(fs.readFileSync('data/catalog/hsb_registro.csv', 'utf8')).map(r => [Number(r.hsb), r])));
  const fuentesD = new Map(csv(gz('data/catalog/hsb_fuentes.csv.gz')).map(f => [Number(f.hsb), f]));
  const athyg = new Map(csv(fs.readFileSync('data/raw/hyglike_from_athyg_v32.csv', 'utf8')).map(r => [Number(r.id), r]));
  const sistemas = JSON.parse(fs.readFileSync('data/processed/star_systems.json', 'utf8'));
  const curadas = new Map(DISTANCIAS_CURADAS.map(c => [c.i, c]));
  log(`Hoshi: ${estrellas.length} estrellas, ${registro.size} filas del registro, ${Object.keys(sistemas).length} sistemas`);
  // --- Gaia DR3 (estrellas del registro) ---
  const gaia = new Map();
  for (const g of (await leerGaiaRegistro()).values()) {
    const ra = num(g.ra), dec = num(g.dec);
    gaia.set(g.source_id, { id: g.source_id, plx: num(g.parallax), err: num(g.parallax_error), G: num(g.phot_g_mean_mag), bpRp: num(g.bp_rp),
      ruwe: num(g.ruwe), pmra: num(g.pmra), pmdec: num(g.pmdec),
      ...(ra !== null ? { nativa: { ra, dec }, j2000: aJ2000(ra, dec, num(g.pmra), num(g.pmdec), num(g.ref_epoch) ?? 2016) } : {}) });
  }
  // --- Hipparcos 2007 ---
  const hip = new Map(), cieloHip = new Cielo();
  for (const h of csv(gz('data/raw/hipparcos/hipparcos_2007.csv.gz'))) {
    const ra = num(h.ra), dec = num(h.dec);
    const o = { id: Number(h.hip), plx: num(h.plx), err: num(h.e_plx), Hp: num(h.hpmag), bv: num(h.b_v), pmra: num(h.pmra), pmdec: num(h.pmdec),
      nativa: { ra, dec }, j2000: aJ2000(ra, dec, num(h.pmra), num(h.pmdec), 1991.25) };
    hip.set(o.id, o); cieloHip.agregar(o);
  }
  log(`Gaia DR3 del registro ${gaia.size}; Hipparcos 2007 ${hip.size}`);
  // --- CNS5 ---
  const filasCns5 = csv(fs.readFileSync('data/raw/cns5/cns5_main.csv', 'utf8'));
  const cns5 = indiceCns5(filasCns5), cieloCns5 = new Cielo();
  for (const f of filasCns5) {
    if (num(f.ra) === null) continue;
    f.nativa = { ra: num(f.ra), dec: num(f.dec) };
    f.j2000 = aJ2000(num(f.ra), num(f.dec), num(f.pmra), num(f.pmdec), num(f.epoch) ?? 2000);
    cieloCns5.agregar(f);
  }
  // --- GCNS ---
  const gcns = new Map(), cieloGcns = new Cielo();
  for (const g of filasSimples(gz('data/raw/gcns/gcns_main.csv.gz'), ['source_id', 'ra', 'dec', 'parallax', 'parallax_error', 'pmra', 'pmdec', 'ruwe', 'phot_g_mean_mag', 'phot_bp_mean_mag', 'phot_rp_mean_mag', 'gcns_prob'])) {
    const ra = num(g.ra), dec = num(g.dec), bp = num(g.phot_bp_mean_mag), rp = num(g.phot_rp_mean_mag);
    const o = { id: g.source_id, plx: num(g.parallax), err: num(g.parallax_error), ruwe: num(g.ruwe), G: num(g.phot_g_mean_mag),
      bpRp: bp !== null && rp !== null ? bp - rp : null, prob: num(g.gcns_prob), pmra: num(g.pmra), pmdec: num(g.pmdec),
      nativa: { ra, dec }, j2000: aJ2000(ra, dec, num(g.pmra), num(g.pmdec), 2016) };
    gcns.set(o.id, o); cieloGcns.agregar(o);
  }
  log(`CNS5 ${filasCns5.length}; GCNS ${gcns.size}`);
  // --- Millón de Gaia DR3 (capa de fondo) ---
  const gaia1m = new Map(), cielo1m = new Cielo();
  for (const g of filasSimples(gz('data/raw/gaia/gaia_dr3_1m.csv.gz'), ['source_id', 'ra', 'dec', 'parallax', 'parallax_over_error', 'pmra', 'pmdec', 'phot_g_mean_mag', 'bp_rp'])) {
    const ra = num(g.ra), dec = num(g.dec), plx = num(g.parallax);
    const o = { id: g.source_id, plx, err: plx / num(g.parallax_over_error), G: num(g.phot_g_mean_mag), bpRp: num(g.bp_rp), pmra: num(g.pmra), pmdec: num(g.pmdec),
      nativa: { ra, dec }, j2000: aJ2000(ra, dec, num(g.pmra), num(g.pmdec), 2016) };
    gaia1m.set(o.id, o); cielo1m.agregar(o);
  }
  log(`Gaia DR3 (millón) ${gaia1m.size}`);
  const seleccion = csv(gz('data/catalog/gaia_1m_seleccion.csv.gz'));
  const enlazadasCapa = new Map(csv(fs.readFileSync('data/catalog/hsb_capa_enlazadas.csv', 'utf8')).map(r => [r.gaia_dr3, Number(r.hsb)]));
  // Número HSB de las fuentes de Gaia: registro y lotes.
  const hsbDeGaia = new Map();
  for (const r of registro.values()) if (r.gaia_dr3 && r.estado === 'activa') hsbDeGaia.set(r.gaia_dr3, Number(r.hsb));
  for (const nombre of fs.readdirSync('data/catalog/hsb_gaia').filter(f => f.endsWith('.csv.gz')).sort()) {
    for (const r of csv(gz(`data/catalog/hsb_gaia/${nombre}`))) if (!hsbDeGaia.has(r.gaia_dr3)) hsbDeGaia.set(r.gaia_dr3, Number(r.hsb));
  }
  // --- 2MASS (tabla de vecinos oficial de Gaia DR3) ---
  const tmass = new Map();
  for (const r of filasSimples(gz('data/raw/tmass/gaia_dr3_tmass.csv.gz'), ['source_id', 'tmass'])) tmass.set(r.source_id, r.tmass.replace(/"/g, ''));
  // --- Exoplanetas (cruce NASA de Hoshi), fichas, cúmulos y diámetros ---
  const exo = JSON.parse(fs.readFileSync('data/exoplanets/exoplanet_systems.json', 'utf8')).systems;
  const exoIdentidad = JSON.parse(fs.readFileSync('data/catalog/exoplanet_host_identity.json', 'utf8')).hosts;
  const oficiales = JSON.parse(fs.readFileSync('data/processed/stellar_official.json', 'utf8'));
  const cumulos = JSON.parse(fs.readFileSync('public/data/cumulos.json', 'utf8')).cumulos;
  const jmdc = JSON.parse(fs.readFileSync('data/catalog/jmdc_diametros.json', 'utf8')).estrellas;
  // Distancia y paralaje de cada anfitriona en la tabla compuesta de NASA (para ver si calzan entre sí).
  const nasaPs = new Map();
  for (const p of csv(fs.readFileSync('data/raw/exoplanets/nasa_pscomppars.csv', 'utf8'))) {
    if (!nasaPs.has(p.hostname)) nasaPs.set(p.hostname, { dist: num(p.sy_dist), plx: num(p.sy_plx), plxErr: num(p.sy_plxerr1) });
  }
  log(`2MASS ${tmass.size}; NASA ${exo.length} sistemas; cúmulos ${cumulos.length}`);
  return { estrellas, porId, registro, fuentesD, athyg, sistemas, curadas, gaia, hip, cieloHip, cns5, filasCns5, cieloCns5, gcns, cieloGcns,
    gaia1m, cielo1m, seleccion, enlazadasCapa, hsbDeGaia, tmass, exo, exoIdentidad, oficiales, cumulos, jmdc, nasaPs,
    igualA: new Map(leerEnlaces().filter(f => f.campo === 'igual_a').map(f => [Number(f.hsb), Number(f.valor)])) };
}
