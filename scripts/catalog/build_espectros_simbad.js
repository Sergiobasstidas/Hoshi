// scripts/catalog/build_espectros_simbad.js
// Tipo espectral de SIMBAD (la clasificación que SIMBAD da como principal) para todas las estrellas con número
// HIP o GJ. Escribe data/catalog/espectros_simbad.json: { hip: { número: tipo }, gj: { «66A»: tipo } }.
// Las consultas se guardan en data/raw/red/espectros (ver scripts/catalog/red.js).
import fs from 'node:fs';
import { parse } from 'csv-parse/sync';
import { empezarDescarga, pedir } from './red.js';

const SIMBAD = 'https://simbad.harvard.edu/simbad/sim-tap/sync';
const SALIDA = './data/catalog/espectros_simbad.json';

async function porCatalogo(prefijo) {
  const query = `SELECT i.id, b.sp_type FROM ident AS i JOIN basic AS b ON b.oid = i.oidref WHERE i.id LIKE '${prefijo} %' AND b.sp_type IS NOT NULL`;
  const texto = await pedir('espectros', SIMBAD, { method: 'POST', signal: AbortSignal.timeout(600000),
    body: new URLSearchParams({ request: 'doQuery', lang: 'adql', format: 'csv', maxrec: '2000000', query }), aceptar: (t, r) => r.ok && t.startsWith('id,sp_type') });
  if (!texto.startsWith('id,sp_type')) throw Error(`SIMBAD ${prefijo}: ${texto.slice(0, 200)}`);
  return parse(texto, { columns: true, skip_empty_lines: true }).map(f => [f.id.replace(/\s+/g, ' ').trim(), f.sp_type.trim()]).filter(([, sp]) => sp);
}

empezarDescarga('espectros');
const hip = {}, gj = {};
for (const [id, sp] of await porCatalogo('HIP')) { const m = id.match(/^HIP (\d+)$/); if (m) hip[m[1]] = sp; }
// «GJ 65 A» → «65A», como el número de Gliese sin prefijo de AT-HYG v4.0.
for (const [id, sp] of await porCatalogo('GJ')) { const m = id.match(/^GJ (\d+(?:\.\d+)?) ?([A-Za-z]*)$/); if (m) gj[m[1] + m[2]] = sp; }
const ordenar = o => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
fs.writeFileSync(SALIDA, JSON.stringify({ fuente: 'SIMBAD (CDS), basic.sp_type', hip: ordenar(hip), gj: ordenar(gj) }));
console.log(`Tipos espectrales de SIMBAD: ${Object.keys(hip).length} por HIP, ${Object.keys(gj).length} por GJ`);
