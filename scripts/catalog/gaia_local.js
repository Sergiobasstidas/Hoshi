// scripts/catalog/gaia_local.js
// Astrometría de Gaia DR3 de las estrellas del registro: data/raw/gaia/gaia_dr3_registro.csv.gz (descarga de
// descargar_cercanas.py) más los Gaia que agregan las correcciones de enlace (data/catalog/hsb_enlaces.csv), que se
// bajan del archivo de Gaia (ESA) con red.js a data/raw/red/gaia_enlaces.
//   HOSHI_RED=descargar node scripts/catalog/gaia_local.js   baja los que falten
import fs from 'node:fs';
import zlib from 'node:zlib';
import { parse } from 'csv-parse/sync';
import { pedir } from './red.js';

const REGISTRO = './data/raw/gaia/gaia_dr3_registro.csv.gz', ENLACES = './data/catalog/hsb_enlaces.csv';
const GAIA_TAP = 'https://gea.esac.esa.int/tap-server/tap/sync';
const COLUMNAS = 'source_id,ra,dec,ref_epoch,parallax,parallax_error,pmra,pmdec,phot_g_mean_mag,bp_rp,ruwe';
const LOTE = 400;

const csvGz = ruta => parse(zlib.gunzipSync(fs.readFileSync(ruta)).toString('utf8'), { columns: true, skip_empty_lines: true });

// Gaia de las correcciones que no están en la descarga del registro, en orden fijo (el archivo de correcciones solo
// crece, así que la consulta guardada sirve sin red).
function idsDeEnlaces(registro) {
  const ids = fs.existsSync(ENLACES) ? parse(fs.readFileSync(ENLACES, 'utf8'), { columns: true }).filter(f => f.campo === 'gaia_dr3' && f.valor).map(f => f.valor) : [];
  return [...new Set(ids)].filter(id => !registro.has(id)).sort();
}

async function filasDeEnlaces(registro) {
  const ids = idsDeEnlaces(registro), filas = [];
  for (let k = 0; k < ids.length; k += LOTE) {
    const query = `SELECT ${COLUMNAS} FROM gaiadr3.gaia_source WHERE source_id IN (${ids.slice(k, k + LOTE).join(',')})`;
    const texto = await pedir('gaia_enlaces', GAIA_TAP, { method: 'POST', signal: AbortSignal.timeout(300000),
      body: new URLSearchParams({ request: 'doQuery', lang: 'adql', format: 'csv', query }), aceptar: (t, r) => r.ok && t.startsWith('source_id') });
    filas.push(...parse(texto, { columns: true, skip_empty_lines: true }));
  }
  return filas;
}

// Map source_id → fila (mismas columnas que gaia_dr3_registro.csv.gz).
export async function leerGaiaRegistro() {
  const registro = new Map(csvGz(REGISTRO).map(g => [g.source_id, g]));
  for (const g of await filasDeEnlaces(registro)) if (!registro.has(g.source_id)) registro.set(g.source_id, g);
  return registro;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const base = new Map(csvGz(REGISTRO).map(g => [g.source_id, g]));
  const extra = await filasDeEnlaces(base);
  console.log(`Gaia DR3 de las correcciones de enlace: ${idsDeEnlaces(base).length} pedidos, ${extra.length} devueltos`);
}
