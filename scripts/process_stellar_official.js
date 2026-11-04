// Datos físicos de las estrellas con nombre desde catálogos oficiales, sin calcular nada:
// diámetros medidos del JMDC, NASA Exoplanet Archive, TESS Input Catalog v8.2 (MAST), Gaia DR3 y SIMBAD. Por cada
// dato vale la primera fuente que lo tenga (regla de radios: lo medido antes que los catálogos). Se ejecuta a mano
// y escribe data/processed/stellar_official.json.
import fs from 'node:fs';
import { ESTRELLAS_CURADAS, ESTRELLAS_CURADAS_POR_ID } from './catalog/estrellas_curadas.js';

const SIMBAD = 'https://simbad.harvard.edu/simbad/sim-tap/sync';
const en = (lista, n) => Array.from({ length: Math.ceil(lista.length / n) }, (_, i) => lista.slice(i * n, i * n + n));
const positivo = valor => { const n = Number(valor); return valor !== null && valor !== '' && Number.isFinite(n) && n > 0 ? n : null; };

function csv(texto) {
  const filas = texto.trim().split('\n').map(linea => linea.match(/("([^"]*)"|[^,]*)(,|$)/g).map(c => c.replace(/,$/, '').replace(/^"|"$/g, '')));
  const [cabecera, ...resto] = filas;
  return resto.map(fila => Object.fromEntries(cabecera.map((c, i) => [c, fila[i]])));
}
async function tap(url, query, lang = 'ADQL') {
  const r = await fetch(url, { signal: AbortSignal.timeout(120000), method: 'POST', body: new URLSearchParams({ request: 'doQuery', lang, format: 'csv', query }) });
  const texto = await r.text();
  if (!r.ok || texto.startsWith('<')) throw Error(`${url}: ${(texto.match(/QUERY_STATUS[^<]*/) || [texto.slice(0, 300)])[0]}`);
  return csv(texto);
}

async function exoplanetArchive() {
  const r = await fetch('https://exoplanetarchive.ipac.caltech.edu/TAP/sync?format=csv&query=' + encodeURIComponent('select distinct hip_name,st_teff,st_rad,st_mass,st_lum,st_spectype from pscomppars where hip_name is not null'));
  const texto = await r.text();
  if (!r.ok || !texto.startsWith('hip_name')) throw Error(`NASA: ${texto.slice(0, 200)}`);
  return new Map(csv(texto).map(f => [Number(f.hip_name.replace('HIP ', '')), { temperatureK: positivo(f.st_teff), radiusSolar: positivo(f.st_rad), massSolar: positivo(f.st_mass),
    luminositySolar: f.st_lum === '' ? null : 10 ** Number(f.st_lum), espectro: f.st_spectype || null }]));
}
async function tic(hips) {
  const filas = new Map();
  for (const grupo of en(hips, 150)) {
    const request = JSON.stringify({ service: 'Mast.Catalogs.Filtered.Tic', format: 'json', pagesize: 500, page: 1,
      params: { columns: 'ID,HIP,GAIA,Teff,rad,mass,lum', filters: [{ paramName: 'HIP', values: grupo.map(String) }] } });
    const r = await fetch('https://mast.stsci.edu/api/v0/invoke', { signal: AbortSignal.timeout(45000), method: 'POST', body: new URLSearchParams({ request }) });
    // Un HIP puede tener varias filas: siempre la misma, primero las que traen radio y luego el ID menor.
    for (const f of (await r.json()).data || []) {
      const previa = filas.get(Number(f.HIP));
      if (!previa || (f.rad && !previa.rad) || (Boolean(f.rad) === Boolean(previa.rad) && Number(f.ID) < Number(previa.ID))) filas.set(Number(f.HIP), f);
    }
  }
  return filas;
}
// Identificador Gaia DR3 de cada estrella según SIMBAD, buscada por todos sus nombres.
async function gaiaPorNombres(nombresDe) {
  const estrellaDe = new Map();
  for (const [id, nombres] of nombresDe) for (const nombre of nombres) estrellaDe.set(nombre, id);
  const gaia = new Map();
  for (const grupo of en([...estrellaDe.keys()], 80)) {
    try {
    const ids = grupo.map(n => `'${n.replace(/'/g, "''")}'`).join(',');
    for (const f of await tap(SIMBAD, `SELECT i.id AS nombre, j.id AS gaia FROM ident AS i JOIN ident AS j ON j.oidref = i.oidref WHERE i.id IN (${ids}) AND j.id LIKE 'Gaia DR3 %'`, 'adql')) {
      gaia.set(estrellaDe.get(f.nombre), f.gaia.replace('Gaia DR3 ', ''));
    }
    } catch (error) { console.warn(`SIMBAD, grupo omitido: ${error.message}`); }
  }
  return gaia;
}
async function ticPorGaia(ids) {
  const filas = new Map();
  for (const grupo of en(ids, 60)) {
    const request = JSON.stringify({ service: 'Mast.Catalogs.Filtered.Tic', format: 'json', pagesize: 500, page: 1,
      params: { columns: 'ID,HIP,GAIA,Teff,rad,mass,lum', filters: [{ paramName: 'GAIA', values: grupo }] } });
    try {
      const r = await fetch('https://mast.stsci.edu/api/v0/invoke', { signal: AbortSignal.timeout(45000), method: 'POST', body: new URLSearchParams({ request }) });
      for (const f of (await r.json()).data || []) filas.set(String(f.GAIA), f);
    } catch (error) { console.warn(`TIC, grupo omitido: ${error.message}`); }
  }
  return filas;
}
async function gaia(ids) {
  const filas = new Map();
  for (const grupo of en(ids, 200)) {
    const lista = await tap('https://gaia.ari.uni-heidelberg.de/tap/sync', `SELECT a.source_id,a.teff_gspphot,a.radius_flame,a.radius_gspphot,a.mass_flame,a.lum_flame,g.ruwe,g.phot_g_mean_mag FROM gaiadr3.astrophysical_parameters AS a JOIN gaiadr3.gaia_source AS g ON g.source_id = a.source_id WHERE a.source_id IN (${grupo.join(',')})`);
    for (const f of lista) filas.set(f.source_id, f);
  }
  return filas;
}
async function simbad(hips) {
  const filas = new Map(hips.map(hip => [hip, {}]));
  const hip = fila => filas.get(Number(fila.id.replace(/^HIP\s+/, '')));
  for (const grupo of en(hips, 150)) {
    const ids = grupo.map(h => `'HIP ${h}'`).join(',');
    for (const f of await tap(SIMBAD, `SELECT i.id, b.sp_type FROM ident AS i JOIN basic AS b ON b.oid = i.oidref WHERE i.id IN (${ids})`, 'adql')) if (hip(f)) hip(f).sp_type = f.sp_type;
    // De las medidas publicadas se queda la más reciente.
    for (const f of await tap(SIMBAD, `SELECT i.id, m.teff, m.bibcode FROM ident AS i JOIN mesFe_h AS m ON m.oidref = i.oidref WHERE i.id IN (${ids}) AND m.teff > 0 ORDER BY bibcode`, 'adql')) if (hip(f)) hip(f).teff = f.teff;
    // Diámetros medidos publicados: en km, o angulares combinados con la distancia del catálogo.
    for (const f of await tap(SIMBAD, `SELECT i.id, m.diameter, m.unit, m.bibcode FROM ident AS i JOIN mesDiameter AS m ON m.oidref = i.oidref WHERE i.id IN (${ids}) ORDER BY bibcode`, 'adql')) if (hip(f)) Object.assign(hip(f), { diametro: Number(f.diameter), unidad: f.unit.trim() });
  }
  return filas;
}
const radioMedido = (fila, distanciaPc) => fila.unidad === 'km' ? positivo(fila.diametro / 2 / 695700)
  : fila.unidad === 'mas' ? positivo(0.1075 * fila.diametro * distanciaPc) : null;
// GSP-Phot falla en estrellas calientes y muy brillantes, en binarias sin resolver y con mala astrometría.
const radioGspPhotFiable = (g, espectro = '') => Number(g.phot_g_mean_mag) >= 4 && Number(g.ruwe) <= 1.4 && !/\+/.test(espectro) && !/(^|\s)\(?(O|B[0-3])/.test(espectro);
const FUENTE = { nasa: 'NASA Exoplanet Archive', tic: 'TESS Input Catalog v8.2 (MAST)', gaia: 'Gaia DR3', simbad: 'SIMBAD', gspphot: 'Gaia DR3 (radius_gspphot)' };
const stars = JSON.parse(fs.readFileSync('data/processed/stars_15pc.json', 'utf8')).filter(s => (s.n && s.n !== 'Sol') || ESTRELLAS_CURADAS_POR_ID[s.i]);
const busqueda = new Map(JSON.parse(fs.readFileSync('public/data/star-search.json', 'utf8')));
// Diámetros medidos del JMDC (scripts/catalog/build_jmdc.js), por número HD.
const jmdc = new Map(JSON.parse(fs.readFileSync('data/catalog/jmdc_diametros.json', 'utf8')).estrellas.map(e => [e.hd, e]));
const hdDe = star => { const a = (busqueda.get(star.i) || []).find(alias => /^HD \d+$/.test(alias)); return a ? Number(a.slice(3)) : null; };
// Radio medido = diámetro angular × distancia del catálogo; no en binarias, donde la medida mezcla dos estrellas.
const radioJmdc = (medida, distanciaPc, espectro = '') => medida && distanciaPc > 0 && !/\+/.test(espectro)
  ? { radiusSolar: 0.1075 * medida.ld * distanciaPc, fuente: `JMDC (Duvert 2016), ${medida.bibcode}; diámetro ${medida.ld} ± ${medida.error} mas (${medida.metodo}) × distancia del catálogo, ${distanciaPc.toFixed(1)} pc` } : null;
const hipDe = star => { const a = (busqueda.get(star.i) || []).find(alias => /^HIP \d+$/.test(alias)); return a ? Number(a.slice(4)) : null; };
const hips = [...new Set(stars.map(hipDe).filter(Boolean))];
const [nasa, ticFilas, simbadFilas] = [await exoplanetArchive(), await tic(hips), await simbad(hips)];
const nombresDe = stars.map(star => [star.i, [...(busqueda.get(star.i) || []).filter(alias => /^(HIP|HD|HR|Gl|GJ) /.test(alias)).map(alias => alias.replace(/^Gl /, 'GJ ').replace(/([A-Z])$/, ' $1')),
  ...(busqueda.get(star.i) || []).filter(alias => /^(HIP|HD|HR|Gl|GJ) /.test(alias)).map(alias => alias.replace(/^Gl /, 'GJ ')), ...(star.n ? [`NAME ${star.n}`, star.n] : [])].filter(nombre => /^[\x20-\x7e]+$/.test(nombre))]);
const gaiaDe = await gaiaPorNombres(nombresDe);
const ticGaia = await ticPorGaia([...new Set(gaiaDe.values())]);
const gaiaFilas = await gaia([...new Set([...gaiaDe.values(), ...[...ticFilas.values()].map(f => f.GAIA).filter(Boolean).map(String)])]);
const datos = {};
for (const star of stars) {
  const hip = hipDe(star), idGaia = gaiaDe.get(star.i), conRadio = fila => fila?.rad ? fila : null;
  const t = conRadio(ticFilas.get(hip)) || ticGaia.get(idGaia) || ticFilas.get(hip);
  const g = gaiaFilas.get(idGaia) || (t && gaiaFilas.get(String(t.GAIA))), s = simbadFilas.get(hip);
  const medido = radioJmdc(jmdc.get(hdDe(star)), star.d, `${s?.sp_type || ''} ${star.sp || ''}`);
  // Un diámetro que da más del doble o menos de la mitad del radio de catálogo suele ser otra estrella
  // mal enlazada o una medida antigua dudosa: se deja el de catálogo y se avisa para revisarlo.
  const catalogo = t?.rad || g?.radius_flame || nasa.get(hip)?.radiusSolar;
  if (medido && catalogo && (medido.radiusSolar / catalogo > 2 || medido.radiusSolar / catalogo < 0.5)) { console.warn(`JMDC dudoso: ${star.n} ${medido.radiusSolar.toFixed(1)} frente a ${Number(catalogo).toFixed(1)} R☉`); medido.radiusSolar = null; }
  const capas = [
    ['jmdc', medido?.radiusSolar && { radiusSolar: medido.radiusSolar }],
    ['nasa', nasa.get(hip)],
    ['tic', t && { temperatureK: positivo(t.Teff), radiusSolar: positivo(t.rad), massSolar: positivo(t.mass), luminositySolar: positivo(t.lum) }],
    ['gaia', g && { temperatureK: positivo(g.teff_gspphot), radiusSolar: positivo(g.radius_flame), massSolar: positivo(g.mass_flame), luminositySolar: positivo(g.lum_flame) }],
    ['simbad', s && { temperatureK: positivo(s.teff), espectro: s.sp_type || null, radiusSolar: radioMedido(s, star.d) }],
    ['gspphot', g && radioGspPhotFiable(g, `${s?.sp_type || ''} ${star.sp || ''}`) && { radiusSolar: positivo(g.radius_gspphot) }],
  ];
  const fila = { fuentes: {} };
  for (const campo of ['temperatureK', 'radiusSolar', 'massSolar', 'luminositySolar', 'espectro']) {
    for (const [fuente, capa] of capas) if (capa?.[campo]) { fila[campo] = capa[campo]; fila.fuentes[campo] = fuente === 'jmdc' ? medido.fuente : FUENTE[fuente]; break; }
  }
  for (const [campo, [valor, ref]] of Object.entries(ESTRELLAS_CURADAS[star.n] || ESTRELLAS_CURADAS_POR_ID[star.i] || {})) { fila[campo] = valor; fila.fuentes[campo] = ref; }
  if (Object.keys(fila.fuentes).length) datos[star.i] = fila;
}
fs.writeFileSync('data/processed/stellar_official.json', JSON.stringify(datos) + '\n');
const conteo = {};
for (const d of Object.values(datos)) for (const c of ['radiusSolar', 'temperatureK']) if (d.fuentes[c]) (conteo[c] ||= {})[d.fuentes[c]] = (conteo[c][d.fuentes[c]] || 0) + 1;
console.log(JSON.stringify(conteo));
const con = Object.values(datos).filter(d => d.radiusSolar && d.temperatureK).length;
console.log(`${stars.length} con nombre · ${con} con radio y temperatura · ${stars.length - con} sin ellos`);
for (const n of ['Mintaka', 'Betelgeuse', 'Rigel', 'Sirius', "Luyten's Star", 'Rigil Kentaurus', 'Toliman', 'Proxima Centauri', 'Vega', 'Dziban', 'Dziban B']) {
  const s = stars.find(x => x.n === n);
  console.log(n, JSON.stringify(s && datos[s.i]));
}
