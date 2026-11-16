import fs from 'node:fs';
import { parse } from 'csv-parse/sync';
import { WR140_ID } from '../src/scene/stellarTargets.js';
import { CANDIDATA, ordenarNombres, rangoNombre } from '../src/scene/nombresEstrella.js';
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
// --- Orden de los nombres (src/scene/nombresEstrella.js): propio, Bayer, Flamsteed, sistema planetario de NASA,
// variables con letras, catálogos, variables «V» con número y candidatas, y al final AT-HYG y HSB ---
// Nombre del sistema planetario: el de sus planetas sin la letra («Kepler-90 i» → Kepler-90), aunque NASA llame a la
// anfitriona por otro (KOI-351). Si sus planetas tienen nombres de dos sistemas, gana el que no es de candidata.
const idsNasa = 'data/raw/exoplanets/nasa_pscomppars_ids.csv';
const sistemaDeAnfitriona = new Map();
if (fs.existsSync(idsNasa)) for (const p of parse(fs.readFileSync(idsNasa, 'utf8'), { columns: true, skip_empty_lines: true })) {
  const sistema = p.pl_name.replace(/\s+[a-z]{1,2}$|\.\d{2}$/, '');
  if (sistema === p.pl_name) continue;
  const previo = sistemaDeAnfitriona.get(p.hostname);
  if (!previo || (CANDIDATA.test(previo) && !CANDIDATA.test(sistema))) sistemaDeAnfitriona.set(p.hostname, sistema);
}
const sistemas = new Set(sistemaDeAnfitriona.values());
const propiosDe = new Map();
const agregarPropio = (i, n) => { if (!n) return; if (!propiosDe.has(i)) propiosDe.set(i, new Set()); propiosDe.get(i).add(n); };
for (const r of rows) if (r.proper) agregarPropio(Number(r.id), r.proper);
agregarPropio(WR140_ID, 'Wolf-Rayet 140');
const porId = new Map(index.map(row => [row[0], row]));
const anfitrionaAnadida = new Map();
if (fs.existsSync(addedPath)) for (const star of JSON.parse(fs.readFileSync(addedPath, 'utf8')).stars) for (const h of star.hosts || [star.h]) anfitrionaAnadida.set(h, star.i);
if (fs.existsSync(identityPath)) for (const host of JSON.parse(fs.readFileSync(identityPath, 'utf8')).hosts) {
  const i = host.i ?? anfitrionaAnadida.get(host.h);
  if (i === undefined) continue;
  for (const a of host.alias) if (a.startsWith('NAME ')) agregarPropio(i, a.slice(5));
  // El nombre del sistema planetario también se busca, aunque la anfitriona tenga otro.
  const sistema = sistemaDeAnfitriona.get(host.h), row = porId.get(i);
  if (sistema && row && !row[1].includes(sistema)) row[1].push(sistema);
}
const filaRegistro = fs.existsSync(registroPath) ? new Map(parse(fs.readFileSync(registroPath, 'utf8'), { columns: true }).map(r => [Number(r.hsb), r])) : new Map();
for (const [hsb, r] of filaRegistro) if (r.nombre && ['athyg_v40', 'cns5'].includes(r.origen)) agregarPropio(hsb, r.nombre);
// Un Bayer o Flamsteed que comparten las componentes de un sistema (61 Cyg A y B) lleva su letra; la componente A
// conserva además el nombre sin letra, para que «61 Cygni» dé con ella.
const compartidos = new Map();
for (const [i, nombres] of index) for (const n of nombres) {
  const rango = rangoNombre(n);
  if (rango === 1 || rango === 2) { if (!compartidos.has(n)) compartidos.set(n, []); compartidos.get(n).push(i); }
}
for (const [n, ids] of compartidos) {
  if (ids.length < 2) continue;
  const letras = ids.map(i => filaRegistro.get(i)?.comp || '');
  if (letras.some(l => !l) || new Set(letras).size !== letras.length) continue;
  ids.forEach((i, k) => {
    const row = porId.get(i);
    row[1] = row[1].flatMap(a => (a === n ? (letras[k] === 'A' ? [n, `${n} ${letras[k]}`] : [`${n} ${letras[k]}`]) : [a]));
  });
}
// Sin los prefijos de SIMBAD («* rho Cnc B» → rho Cnc B, «V* R Leo» → R Leo).
for (const row of index) row[1] = [...new Set(row[1].map(n => n.replace(/^V?\* /, '')))];
const salida = index.map(([i, nombres]) => {
  const [orden, principales] = ordenarNombres(nombres, { propios: propiosDe.get(i), sistemas });
  return principales ? [i, orden, principales] : [i, orden];
});
fs.mkdirSync('public/data', { recursive: true });
fs.writeFileSync('public/data/star-search.json', JSON.stringify(salida));
console.log(`Índice: ${index.length} estrellas (catálogo base, anfitrionas añadidas y estrellas nuevas del registro HSB), alias enlazados por ID.`);
