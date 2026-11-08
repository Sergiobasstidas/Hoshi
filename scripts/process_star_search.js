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
// Estrellas que entraron desde el registro HSB (AT-HYG v4.0 y CNS5): nombre propio y luego números de catálogo
// (Gliese, HIP, HD, TYC, Gaia DR3, 2MASS), como dice la regla de nombres del catálogo HSB.
const registroPath = 'data/catalog/hsb_registro.csv';
if (fs.existsSync(registroPath)) for (const r of parse(fs.readFileSync(registroPath, 'utf8'), { columns: true })) {
  const hsb = Number(r.hsb);
  if (!['athyg_v40', 'cns5'].includes(r.origen) || !ids.has(hsb)) continue;
  const aliases = [r.nombre, r.gl, r.hip && `HIP ${r.hip}`, r.hd && `HD ${r.hd}`, r.hr && `HR ${r.hr}`, r.tyc && `TYC ${r.tyc}`,
    r.gaia_dr3 && `Gaia DR3 ${r.gaia_dr3}`, r.tmass && `2MASS J${r.tmass}`, `HSB ${hsb}`].filter(Boolean);
  index.push([hsb, [...new Set(aliases)]]);
}
fs.mkdirSync('public/data', { recursive: true });
fs.writeFileSync('public/data/star-search.json', JSON.stringify(index));
console.log(`Índice: ${index.length} estrellas (catálogo base, anfitrionas añadidas y estrellas nuevas del registro HSB), alias enlazados por ID.`);
