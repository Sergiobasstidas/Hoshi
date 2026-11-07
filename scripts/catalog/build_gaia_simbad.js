// Identificador de Gaia DR3 según SIMBAD para las estrellas de Hoshi que hipparcos2_best_neighbour no enlazó
// (casi siempre muy brillantes). Escribe data/catalog/gaia_simbad.json: { i: source_id }. Las consultas a SIMBAD
// se guardan en data/raw/red/gaia_simbad (ver scripts/catalog/red.js).
import fs from 'node:fs';
import { empezarDescarga, pedir } from './red.js';

empezarDescarga('gaia_simbad');
const identidad = JSON.parse(fs.readFileSync('data/catalog/star_identity.json', 'utf8')).stars;
const sinGaia = identidad.filter(s => !s.gaia && s.hip);
const porHip = new Map(sinGaia.map(s => [`HIP ${s.hip}`, s.i]));
const resultado = {};
for (let k = 0; k < sinGaia.length; k += 300) {
  const ids = sinGaia.slice(k, k + 300).map(s => `'HIP ${s.hip}'`).join(',');
  const query = `SELECT h.id AS hip, g.id AS gaia FROM ident AS h JOIN ident AS g ON g.oidref = h.oidref WHERE h.id IN (${ids}) AND g.id LIKE 'Gaia DR3 %'`;
  const texto = await pedir('gaia_simbad', 'https://simbad.harvard.edu/simbad/sim-tap/sync', { method: 'POST', signal: AbortSignal.timeout(120000),
    body: new URLSearchParams({ request: 'doQuery', lang: 'adql', format: 'csv', query }), aceptar: (t, r) => r.ok && t.startsWith('hip,gaia') });
  if (!texto.startsWith('hip,gaia')) throw Error(`SIMBAD: ${texto.slice(0, 200)}`);
  for (const linea of texto.trim().split('\n').slice(1)) {
    const [hip, gaia] = linea.replace(/"/g, '').split(',');
    resultado[porHip.get(hip)] = gaia.replace('Gaia DR3 ', '');
  }
}
fs.writeFileSync('data/catalog/gaia_simbad.json', JSON.stringify({ fuente: 'SIMBAD (CDS), identificadores Gaia DR3', estrellas: resultado }));
console.log(`${sinGaia.length} estrellas con HIP y sin Gaia DR3 · ${Object.keys(resultado).length} enlazadas con SIMBAD`);
