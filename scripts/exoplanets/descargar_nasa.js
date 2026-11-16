// scripts/exoplanets/descargar_nasa.js
// Tablas del NASA Exoplanet Archive y astrometría de Gaia DR3 de las anfitrionas, por red.js (scripts/catalog/red.js):
//  - data/raw/exoplanets/nasa_pscomppars.csv       select * from pscomppars (paso nasa_exoplanetas)
//  - data/raw/exoplanets/nasa_pscomppars_ids.csv   identificadores y multiplicidad de pscomppars (mismo paso)
//  - data/raw/gaia/gaia_dr3_exoplanet_hosts_nuevas.csv
//      Gaia DR3 (TAP de ARI Heidelberg, paso gaia_anfitriones) de las anfitrionas cuyo Gaia DR3 no está en
//      data/raw/gaia/gaia_dr3_exoplanet_hosts.csv (descarga del 13/10/2026), con las mismas columnas, en lotes de
//      LOTE source_id ordenados. build_star_identity.js y build_added_hosts.js leen las dos.
// Sin red, escribe los mismos archivos desde lo guardado (los deja igual si no cambiaron).
//   HOSHI_RED=descargar node scripts/exoplanets/descargar_nasa.js   (o npm run descargar:red)
import fs from 'node:fs';
import { parse } from 'csv-parse/sync';
import { DESCARGAR, pedir } from '../catalog/red.js';

const NASA_TAP = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync', GAIA_TAP = 'https://gaia.ari.uni-heidelberg.de/tap/sync';
export const PSCOMPPARS = './data/raw/exoplanets/nasa_pscomppars.csv', IDS = './data/raw/exoplanets/nasa_pscomppars_ids.csv';
export const GAIA_BASE = './data/raw/gaia/gaia_dr3_exoplanet_hosts.csv', GAIA_NUEVAS = './data/raw/gaia/gaia_dr3_exoplanet_hosts_nuevas.csv';
const CONSULTA_IDS = 'select pl_name,hostname,hd_name,hip_name,tic_id,gaia_dr2_id,gaia_dr3_id,sy_snum,sy_pnum,cb_flag from pscomppars';
// Mismas columnas que descargar_gaia.py (radius_gspphot vive en astrophysical_parameters).
const COLUMNAS = 'g.source_id, g.ra, g.dec, g.ref_epoch, g.parallax, g.parallax_error, g.pmra, g.pmdec, g.radial_velocity, g.phot_g_mean_mag, '
  + 'g.bp_rp, g.ruwe, g.non_single_star, g.teff_gspphot, ap.radius_gspphot, g.distance_gspphot';
const LOTE = 400;

const escribir = (ruta, texto) => { if (!fs.existsSync(ruta) || fs.readFileSync(ruta, 'utf8') !== texto) fs.writeFileSync(ruta, texto); };
const leerCsv = texto => parse(texto, { columns: true, skip_empty_lines: true, relax_quotes: true });

async function nasa(paso, query) {
  if (DESCARGAR) fs.mkdirSync(`./data/raw/red/${paso}`, { recursive: true });
  return pedir(paso, `${NASA_TAP}?${new URLSearchParams({ query, format: 'csv' })}`, { signal: AbortSignal.timeout(900000),
    aceptar: (t, r) => r.ok && /^[a-z0-9_]+,/.test(t.slice(0, 40)) });
}

const pscomppars = await nasa('nasa_exoplanetas', 'select * from pscomppars');
const ids = await nasa('nasa_exoplanetas', CONSULTA_IDS);
fs.mkdirSync('./data/raw/exoplanets', { recursive: true });
escribir(PSCOMPPARS, pscomppars);
escribir(IDS, ids);

// Gaia DR3 de las anfitrionas que faltan en la descarga base.
const base = new Set(leerCsv(fs.readFileSync(GAIA_BASE, 'utf8')).map(g => g.source_id));
const faltan = [...new Set(leerCsv(ids).map(r => r.gaia_dr3_id.replace(/^Gaia DR3\s*/, '')).filter(id => id && !base.has(id)))]
  .sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0));
if (DESCARGAR) fs.mkdirSync('./data/raw/red/gaia_anfitriones', { recursive: true });
let cabecera = null;
const filas = [];
for (let k = 0; k < faltan.length; k += LOTE) {
  const query = `SELECT ${COLUMNAS} FROM gaiadr3.gaia_source AS g LEFT JOIN gaiadr3.astrophysical_parameters AS ap ON ap.source_id = g.source_id `
    + `WHERE g.source_id IN (${faltan.slice(k, k + LOTE).join(',')})`;
  const texto = await pedir('gaia_anfitriones', GAIA_TAP, { method: 'POST', signal: AbortSignal.timeout(300000),
    body: new URLSearchParams({ request: 'doQuery', lang: 'adql', format: 'csv', query }), aceptar: (t, r) => r.ok && t.startsWith('source_id') });
  const lineas = texto.trim().split('\n');
  cabecera ??= lineas[0];
  filas.push(...lineas.slice(1));
}
filas.sort((a, b) => { const x = BigInt(a.split(',')[0]), y = BigInt(b.split(',')[0]); return x < y ? -1 : x > y ? 1 : 0; });
escribir(GAIA_NUEVAS, `${cabecera ?? COLUMNAS.replace(/\b[a-z]+\./g, '').replace(/ /g, '')}\n${filas.join('\n')}${filas.length ? '\n' : ''}`);
console.log(`✓ NASA pscomppars: ${leerCsv(ids).length} planetas; Gaia DR3 de anfitrionas fuera de la descarga base: ${faltan.length} pedidas, ${filas.length} recibidas`);
