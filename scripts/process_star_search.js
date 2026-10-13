import fs from 'node:fs';
import { parse } from 'csv-parse/sync';
import { WR140_ID } from '../src/scene/stellarTargets.js';
const stars = JSON.parse(fs.readFileSync('data/processed/stars_15pc.json', 'utf8'));
const ids = new Set(stars.filter(s => [s.x, s.y, s.z].every(Number.isFinite)).map(s => s.i));
const rows = parse(fs.readFileSync('data/raw/hyglike_from_athyg_v32.csv', 'utf8'), { columns: true });
// El archivo guardado contiene solo estrellas del catálogo base. Los registros
// curados (Eta Carinae) se añaden en el navegador con addCuratedSearchRows.
const index = rows.filter(r => ids.has(Number(r.id))).map(r => {
  const aliases = [r.proper, ...[['HIP', r.hip], ['HD', r.hd], ['HR', r.hr]].map(([p,v]) => v ? `${p} ${v}` : ''),
    r.gl, r.bf, r.bayer && `${r.bayer} ${r.con}`, r.flam && `${r.flam} ${r.con}`, `AT-HYG ${r.id}`].filter(Boolean);
  if (Number(r.id) === WR140_ID) aliases.unshift('Wolf-Rayet 140', 'WR 140');
  return [Number(r.id), [...new Set(aliases)]];
});
// Anfitrionas de exoplanetas: las de AT-HYG ganan el nombre que usa la NASA y las
// añadidas (data/catalog/added_hosts.json) entran con sus alias de SIMBAD.
const identityPath = 'data/catalog/exoplanet_host_identity.json', addedPath = 'data/catalog/added_hosts.json';
if (fs.existsSync(identityPath)) {
  const byId = new Map(index.map(row => [row[0], row]));
  for (const host of JSON.parse(fs.readFileSync(identityPath, 'utf8')).hosts) {
    const row = host.i !== null && byId.get(host.i);
    if (row && !row[1].includes(host.h)) row[1].push(host.h);
  }
}
if (fs.existsSync(addedPath)) for (const star of JSON.parse(fs.readFileSync(addedPath, 'utf8')).stars) {
  if (ids.has(star.i)) index.push([star.i, star.alias]);
}
fs.mkdirSync('public/data', { recursive: true });
fs.writeFileSync('public/data/star-search.json', JSON.stringify(index));
console.log(`Índice: ${index.length} estrellas (catálogo base y anfitrionas añadidas), alias enlazados por ID.`);
