// Identificador de Gaia DR3 según SIMBAD para las estrellas de Hoshi que hipparcos2_best_neighbour no enlazó
// (casi siempre muy brillantes). Se ejecuta a mano y escribe data/catalog/gaia_simbad.json: { i: source_id }.
import fs from 'node:fs';

const identidad = JSON.parse(fs.readFileSync('data/catalog/star_identity.json', 'utf8')).stars;
const sinGaia = identidad.filter(s => !s.gaia && s.hip);
const porHip = new Map(sinGaia.map(s => [`HIP ${s.hip}`, s.i]));
const resultado = {};
for (let k = 0; k < sinGaia.length; k += 300) {
  const ids = sinGaia.slice(k, k + 300).map(s => `'HIP ${s.hip}'`).join(',');
  const query = `SELECT h.id AS hip, g.id AS gaia FROM ident AS h JOIN ident AS g ON g.oidref = h.oidref WHERE h.id IN (${ids}) AND g.id LIKE 'Gaia DR3 %'`;
  const r = await fetch('https://simbad.harvard.edu/simbad/sim-tap/sync', { method: 'POST', signal: AbortSignal.timeout(120000), body: new URLSearchParams({ request: 'doQuery', lang: 'adql', format: 'csv', query }) });
  const texto = await r.text();
  if (!r.ok || !texto.startsWith('hip,gaia')) throw Error(`SIMBAD: ${texto.slice(0, 200)}`);
  for (const linea of texto.trim().split('\n').slice(1)) {
    const [hip, gaia] = linea.replace(/"/g, '').split(',');
    resultado[porHip.get(hip)] = gaia.replace('Gaia DR3 ', '');
  }
}
fs.writeFileSync('data/catalog/gaia_simbad.json', JSON.stringify({ fuente: 'SIMBAD (CDS), identificadores Gaia DR3', estrellas: resultado }));
console.log(`${sinGaia.length} estrellas con HIP y sin Gaia DR3 · ${Object.keys(resultado).length} enlazadas con SIMBAD`);
