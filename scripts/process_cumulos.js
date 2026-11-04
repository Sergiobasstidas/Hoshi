// Cúmulos de estrellas del Unified Cluster Catalogue (UCC; Perren et al. 2023, MNRAS 526, 4107; Zenodo, CC BY 4.0),
// versión 260615. Los miembros se identificaron con Gaia DR3 por posición, movimiento propio y paralaje, con una
// probabilidad de pertenencia; aquí se cuentan los de probabilidad mayor que 0,5, como hace el UCC.
// Se cruzan con las estrellas de Hoshi por el identificador de Gaia DR3 y se escriben solo los cúmulos con al menos
// tres miembros en Hoshi. Se ejecuta a mano: los archivos del UCC van en data/raw/ucc/ (el de miembros no se sube).
import fs from 'node:fs';
import { parse } from 'csv-parse/sync';
import { asyncBufferFromFile, parquetReadObjects } from 'hyparquet';
import { compressors } from 'hyparquet-compressors';

const VERSION = '260615';
const MINIMO_EN_HOSHI = 3;
const PROBABILIDAD = 0.5;
// Nombres en español de los cúmulos conocidos, por su nombre en el UCC.
const NOMBRES = { hyades: 'Híades', pleiades: 'Pléyades', ngc2632: 'Pesebre', melotte111: 'Cúmulo de Coma Berenices',
  melotte20: 'Cúmulo de Alfa Persei', ic2391: 'IC 2391 (Omicron Velorum)', ic2602: 'IC 2602 (Pléyades del Sur)',
  ngc6475: 'Cúmulo de Ptolomeo (M7)', ngc2422: 'Messier 47', ngc2287: 'Messier 41', ngc7092: 'Messier 39', ngc3532: 'NGC 3532 (Pozo de los Deseos)' };

const redondeo = valor => { const n = numero(valor); return n === null ? null : Number(n.toFixed(1)); };
const numero = valor => { const n = Number(valor); return valor !== 'nan' && valor !== '' && Number.isFinite(n) ? n : null; };
const catalogo = parse(fs.readFileSync('data/raw/ucc/UCC_cat.csv', 'utf8'), { columns: true });

// Identificador de Gaia DR3 de cada estrella de Hoshi: catálogo base, anfitrionas añadidas y enlaces de SIMBAD.
const deGaia = new Map();
for (const s of JSON.parse(fs.readFileSync('data/catalog/star_identity.json', 'utf8')).stars) if (s.gaia) deGaia.set(s.gaia, s.i);
for (const s of JSON.parse(fs.readFileSync('data/catalog/added_hosts.json', 'utf8')).stars) if (s.gaia) deGaia.set(s.gaia, s.i);
// Las muy brillantes que el enlace por Hipparcos no resolvió, con el identificador que da SIMBAD.
for (const [i, gaia] of Object.entries(JSON.parse(fs.readFileSync('data/catalog/gaia_simbad.json', 'utf8')).estrellas)) if (!deGaia.has(gaia)) deGaia.set(gaia, Number(i));
const estrellas = new Map(JSON.parse(fs.readFileSync('data/processed/stars_15pc.json', 'utf8')).map(s => [s.i, s]));
// Constelación de cada estrella según AT-HYG: la del cúmulo es la más repetida entre sus miembros.
const constelacionDe = new Map(parse(fs.readFileSync('data/raw/hyglike_from_athyg_v32.csv', 'utf8'), { columns: true }).filter(f => f.con).map(f => [Number(f.id), f.con]));
const masRepetida = ids => { const n = {}; for (const id of ids) { const c = constelacionDe.get(id); if (c) n[c] = (n[c] || 0) + 1; } return Object.entries(n).sort((a, b) => b[1] - a[1])[0]?.[0] || null; };
// Designaciones legibles para la ficha: catálogos conocidos con su número, sin siglas de trabajo (MWSC, OCL, FoF…).
const LEGIBLE = /^(M|Messier|NGC|IC|Melotte|Collinder|Trumpler|Blanco|Platais|Alessi|Stock|Mamajek|Ruprecht|Theia|UPK|HSC|CWWDL|Feigelson) ?\d/;
const designaciones = nombres => [...new Set(nombres.filter(n => LEGIBLE.test(n)).map(n => n.replace(/^(?:Messier |M ?)(\d+)$/, 'Messier $1')))];

const file = await asyncBufferFromFile('data/raw/ucc/UCC_members.parquet');
const miembros = await parquetReadObjects({ file, compressors, columns: ['name', 'Source', 'probs'] });
const enHoshi = new Map();
for (const m of miembros) {
  const id = m.probs > PROBABILIDAD && deGaia.get(String(m.Source));
  if (id === undefined || id === false || !estrellas.has(id)) continue;
  enHoshi.set(m.name, [...(enHoshi.get(m.name) || []), id]);
}

const cumulos = [];
for (const fila of catalogo) {
  const ids = enHoshi.get(fila.name) || [];
  const paralaje = numero(fila.Plx);
  if (ids.length < MINIMO_EN_HOSHI || fila.bad_oc === 'y' || !(paralaje > 0)) continue;
  // Distancia por la paralaje media publicada de sus miembros; posición en el marco de Hoshi (pc, ecuatorial J2000).
  const d = 1000 / paralaje, ra = numero(fila.RA_ICRS) * Math.PI / 180, dec = numero(fila.DE_ICRS) * Math.PI / 180;
  const r50 = numero(fila.r_50);
  // Más brillantes primero, por magnitud absoluta del catálogo de Hoshi.
  ids.sort((a, b) => estrellas.get(a).m - estrellas.get(b).m);
  cumulos.push({
    id: fila.name, nombre: NOMBRES[fila.name] || fila['Name(s)'].split(';')[0].trim(), otrosNombres: fila['Name(s)'].split(';').map(n => n.trim()),
    x: Number((d * Math.cos(dec) * Math.cos(ra)).toFixed(3)), y: Number((d * Math.cos(dec) * Math.sin(ra)).toFixed(3)), z: Number((d * Math.sin(dec)).toFixed(3)),
    d: Number(d.toFixed(1)), paralaje, r50Arcmin: r50, r50Pc: r50 ? Number((d * Math.tan(r50 / 60 * Math.PI / 180)).toFixed(2)) : null,
    miembros: numero(fila.N_membs), edadMyr: numero(fila['Age_[Myr]']), metalicidad: numero(fila['FeH_[dex]']), calidad: fila.C3,
    // Movimiento propio medio (mas/año) y velocidad radial media (km/s) del cúmulo, publicados en el UCC.
    pmRa: redondeo(fila.pmRA), pmDec: redondeo(fila.pmDE), rv: redondeo(fila.Rv),
    ids,
  });
}
// Miembros brillantes (V < 6) que Gaia mide mal y el UCC no trae, como Alcyone o Mirfak: los que SIMBAD enlaza al
// cúmulo con una pertenencia publicada de al menos 70 %, con el artículo de esa pertenencia.
const DESIGNACION = /^(Melotte|NGC|IC|Collinder|Blanco|Platais|Alessi|Trumpler|Stock|Ruprecht|Mamajek) \S+$/;
const hipAId = new Map();
for (const s of JSON.parse(fs.readFileSync('data/catalog/star_identity.json', 'utf8')).stars) if (s.hip) hipAId.set(s.hip, s.i);
const porSimbad = new Map(cumulos.flatMap(c => c.otrosNombres.filter(n => DESIGNACION.test(n)).map(n => [`Cl ${n}`, c])));
const consulta = `SELECT p.id AS cumulo, c.id AS hip, l.membership, l.link_bibcode FROM h_link AS l JOIN ident AS p ON p.oidref = l.parent
  JOIN ident AS c ON c.oidref = l.child JOIN flux AS f ON f.oidref = l.child AND f.filter = 'V'
  WHERE p.id IN (${[...porSimbad.keys()].map(n => `'${n}'`).join(',')}) AND c.id LIKE 'HIP %' AND f.flux < 6 AND l.membership >= 70`;
const respuesta = await (await fetch('https://simbad.harvard.edu/simbad/sim-tap/sync', { method: 'POST', signal: AbortSignal.timeout(120000),
  body: new URLSearchParams({ request: 'doQuery', lang: 'adql', format: 'csv', query: consulta }) })).text();
if (!respuesta.startsWith('cumulo,hip')) throw Error(`SIMBAD: ${respuesta.slice(0, 200)}`);
const normalizar = n => n.replace(/\s+/g, ' ');
// Algunos enlaces de SIMBAD son de grupos de movimiento amplios (el «supercúmulo» de las Híades): solo cuentan las
// estrellas que caen en el cielo a menos de 3 radios con la mitad de los miembros y a una distancia compatible
// (las brillantes tienen paralajes peores, de ahí el margen del 25 %).
function dentroDelCumulo(star, c) {
  const coseno = (star.x * c.x + star.y * c.y + star.z * c.z) / (star.d * Math.hypot(c.x, c.y, c.z));
  const separacionArcmin = Math.acos(Math.min(1, coseno)) * 180 / Math.PI * 60;
  return separacionArcmin <= 3 * (c.r50Arcmin || 0) && Math.abs(star.d - c.d) <= Math.max(3 * (c.r50Pc || 0), 0.25 * c.d);
}
for (const fila of parse(respuesta, { columns: true })) {
  const cumulo = porSimbad.get(normalizar(fila.cumulo)), id = hipAId.get(Number(fila.hip.slice(4)));
  if (!cumulo || id === undefined || !estrellas.has(id) || cumulo.ids.includes(id) || !dentroDelCumulo(estrellas.get(id), cumulo)) continue;
  cumulo.ids.push(id);
  (cumulo.brillantesSimbad ||= {})[id] = fila.link_bibcode;
}
for (const c of cumulos) {
  c.ids.sort((a, b) => estrellas.get(a).m - estrellas.get(b).m);
  c.constelacion = masRepetida(c.ids);
  c.catalogos = designaciones(c.otrosNombres).filter(n => n !== c.nombre);
  delete c.otrosNombres;
}
cumulos.sort((a, b) => b.ids.length - a.ids.length);
fs.writeFileSync('public/data/cumulos.json', JSON.stringify({
  fuente: `Unified Cluster Catalogue (Perren et al. 2023, MNRAS 526, 4107), versión ${VERSION}, Zenodo, CC BY 4.0`,
  fuenteBrillantes: 'SIMBAD (CDS): pertenencia publicada de al menos 70 %, con el artículo de cada una',
  criterio: `miembros con probabilidad > ${PROBABILIDAD}; cúmulos con al menos ${MINIMO_EN_HOSHI} miembros en Hoshi y sin marca de asterismo`,
  cumulos,
}));
const sumadas = cumulos.flatMap(c => Object.keys(c.brillantesSimbad || {}).map(id => `${estrellas.get(Number(id)).n || id} (${c.nombre})`));
console.log(`Miembros brillantes sumados desde SIMBAD: ${sumadas.length}: ${sumadas.join(', ')}`);
console.log(`${catalogo.length} cúmulos en el UCC · ${cumulos.length} con al menos ${MINIMO_EN_HOSHI} miembros en Hoshi`);
for (const c of cumulos.slice(0, 15)) console.log(`${c.nombre.padEnd(32)} ${String(c.ids.length).padStart(4)} en Hoshi de ${c.miembros} · ${c.d} pc`);
for (const id of Object.keys(NOMBRES)) { const c = cumulos.find(x => x.id === id); console.log(NOMBRES[id], c ? `${c.ids.length} en Hoshi` : 'no está'); }
