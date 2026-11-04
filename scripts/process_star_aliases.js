// Nombres de catálogo que AT-HYG no trae, para el buscador: estrellas variables (V* de SIMBAD),
// Gaia DR3 (data/catalog/star_identity.json y, para las muy brillantes, gaia_simbad.json) y TIC (SIMBAD).
// Se ejecuta a mano y escribe dos archivos: los nombres de variables, que se cargan con el índice, y los números de Gaia y TIC, que pesan más
// y solo se piden cuando la búsqueda los parece buscar.
import fs from 'node:fs';

const SIMBAD = 'https://simbad.harvard.edu/simbad/sim-tap/sync';
async function porHip(prefijo) {
  const query = `SELECT h.id AS hip, v.id AS alias FROM ident AS h JOIN ident AS v ON v.oidref = h.oidref WHERE h.id LIKE 'HIP %' AND v.id LIKE '${prefijo} %'`;
  const r = await fetch(SIMBAD, { method: 'POST', signal: AbortSignal.timeout(300000), body: new URLSearchParams({ request: 'doQuery', lang: 'adql', format: 'csv', maxrec: '2000000', query }) });
  const texto = await r.text();
  if (!r.ok || !texto.startsWith('hip,alias')) throw Error(`SIMBAD ${prefijo}: ${texto.slice(0, 200)}`);
  return texto.trim().split('\n').slice(1).map(linea => linea.replace(/"/g, '').split(',')).map(([hip, alias]) => [Number(hip.slice(4)), alias.replace(/\s+/g, ' ').trim()]);
}

const busqueda = JSON.parse(fs.readFileSync('public/data/star-search.json', 'utf8'));
const idDeHip = new Map();
for (const [id, alias] of busqueda) for (const a of alias) if (/^HIP \d+$/.test(a)) idDeHip.set(Number(a.slice(4)), id);
const agrupar = filas => {
  const porId = new Map();
  for (const [id, alias] of filas) if (id !== undefined) porId.set(id, [...(porId.get(id) || []), alias]);
  return [...porId];
};

// «V* VY CMa» → «VY CMa»; «V* V1234 Sgr» → «V1234 Sgr».
const variables = agrupar((await porHip('V*')).map(([hip, alias]) => [idDeHip.get(hip), alias.replace(/^V\* /, '')]));
const identidad = JSON.parse(fs.readFileSync('data/catalog/star_identity.json', 'utf8')).stars;
const tic = await porHip('TIC');
const numeros = agrupar([
  ...identidad.filter(s => s.gaia).map(s => [s.i, `Gaia DR3 ${s.gaia}`]),
  ...Object.entries(JSON.parse(fs.readFileSync('data/catalog/gaia_simbad.json', 'utf8')).estrellas).map(([i, gaia]) => [Number(i), `Gaia DR3 ${gaia}`]),
  ...tic.map(([hip, alias]) => [idDeHip.get(hip), alias]),
]);
fs.writeFileSync('public/data/star-search-variables.json', JSON.stringify(variables));
fs.writeFileSync('public/data/star-search-numeros.json', JSON.stringify(numeros));
console.log(`Variables: ${variables.length} estrellas · Gaia DR3 y TIC: ${numeros.length} estrellas`);
