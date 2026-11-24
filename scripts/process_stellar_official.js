// Datos físicos de las estrellas con nombre (y de las demás con diámetro medido en el JMDC) desde catálogos oficiales, sin calcular nada:
// diámetros medidos del JMDC, NASA Exoplanet Archive, TESS Input Catalog v8.2 (MAST), Gaia DR3 y SIMBAD. Por cada
// dato vale la primera fuente que lo tenga (regla de radios: lo medido antes que los catálogos). Las consultas se
// guardan en data/raw/red/oficiales (ver scripts/catalog/red.js). Escribe data/processed/stellar_official.json.
import fs from 'node:fs';
import { ESTRELLAS_CURADAS, ESTRELLAS_CURADAS_POR_ID } from './catalog/estrellas_curadas.js';
import { empezarDescarga, pedir } from './catalog/red.js';
import zlib from 'node:zlib';
import { parse } from 'csv-parse/sync';
import { leerGaiaRegistro } from './catalog/gaia_local.js';
import { DISTANCIAS_CURADAS } from './catalog/distancias_curadas.js';

const SIMBAD = 'https://simbad.harvard.edu/simbad/sim-tap/sync';
// Lotes en orden fijo (números y nombres ordenados), así las consultas no dependen del orden del catálogo
// (por distancia) y se pueden repetir sin red con lo guardado en data/raw/red.
const ordenFijo = lista => [...lista].sort((a, b) => String(a).length - String(b).length || (String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0));
const en = (lista, n) => { const orden = ordenFijo(lista); return Array.from({ length: Math.ceil(orden.length / n) }, (_, i) => orden.slice(i * n, i * n + n)); };
const positivo = valor => { const n = Number(valor); return valor !== null && valor !== '' && Number.isFinite(n) && n > 0 ? n : null; };

function csv(texto) {
  const filas = texto.trim().split('\n').map(linea => linea.match(/("([^"]*)"|[^,]*)(,|$)/g).map(c => c.replace(/,$/, '').replace(/^"|"$/g, '')));
  const [cabecera, ...resto] = filas;
  return resto.map(fila => Object.fromEntries(cabecera.map((c, i) => [c, fila[i]])));
}
async function tap(url, query, lang = 'ADQL') {
  const texto = await pedir('oficiales', url, { signal: AbortSignal.timeout(120000), method: 'POST',
    body: new URLSearchParams({ request: 'doQuery', lang, format: 'csv', query }), aceptar: (t, r) => r.ok && !t.startsWith('<') });
  if (texto.startsWith('<')) throw Error(`${url}: ${(texto.match(/QUERY_STATUS[^<]*/) || [texto.slice(0, 300)])[0]}`);
  return csv(texto);
}

async function exoplanetArchive() {
  const texto = await pedir('oficiales', 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync?format=csv&query=' + encodeURIComponent('select distinct hip_name,st_teff,st_rad,st_mass,st_lum,st_spectype from pscomppars where hip_name is not null'),
    { aceptar: (t, r) => r.ok && t.startsWith('hip_name') });
  if (!texto.startsWith('hip_name')) throw Error(`NASA: ${texto.slice(0, 200)}`);
  return new Map(csv(texto).map(f => [Number(f.hip_name.replace('HIP ', '')), { temperatureK: positivo(f.st_teff), radiusSolar: positivo(f.st_rad), massSolar: positivo(f.st_mass),
    luminositySolar: f.st_lum === '' ? null : 10 ** Number(f.st_lum), espectro: f.st_spectype || null }]));
}
async function tic(hips) {
  const filas = new Map();
  for (const grupo of en(hips, 150)) {
    const request = JSON.stringify({ service: 'Mast.Catalogs.Filtered.Tic', format: 'json', pagesize: 500, page: 1,
      params: { columns: 'ID,HIP,GAIA,Teff,rad,mass,lum', filters: [{ paramName: 'HIP', values: grupo.map(String) }] } });
    // MAST tarda a veces más de un minuto en esta consulta, y sin ella el paso no puede seguir.
    const texto = await pedir('oficiales', 'https://mast.stsci.edu/api/v0/invoke', { signal: AbortSignal.timeout(180000), method: 'POST', body: new URLSearchParams({ request }) });
    // Un HIP puede tener varias filas: siempre la misma, primero las que traen radio y luego el ID menor.
    for (const f of JSON.parse(texto).data || []) {
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
      const texto = await pedir('oficiales', 'https://mast.stsci.edu/api/v0/invoke', { signal: AbortSignal.timeout(45000), method: 'POST', body: new URLSearchParams({ request }) });
      for (const f of JSON.parse(texto).data || []) filas.set(String(f.GAIA), f);
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
empezarDescarga('oficiales');
const FUENTE = { nasa: 'NASA Exoplanet Archive', tic: 'TESS Input Catalog v8.2 (MAST)', gaia: 'Gaia DR3', simbad: 'SIMBAD', gspphot: 'Gaia DR3 (radius_gspphot)' };
const todas = JSON.parse(fs.readFileSync('data/processed/stars_15pc.json', 'utf8'));
const conNombre = todas.filter(s => (s.n && s.n !== 'Sol') || ESTRELLAS_CURADAS_POR_ID[s.i]);
const busqueda = new Map(JSON.parse(fs.readFileSync('public/data/star-search.json', 'utf8')));
// Diámetros medidos del JMDC (scripts/catalog/build_jmdc.js), por número HD.
const jmdc = new Map(JSON.parse(fs.readFileSync('data/catalog/jmdc_diametros.json', 'utf8')).estrellas.map(e => [e.hd, e]));
const hdDe = star => { const a = (busqueda.get(star.i) || []).find(alias => /^HD \d+$/.test(alias)); return a ? Number(a.slice(3)) : null; };
// Las demás estrellas del catálogo con diámetro en el JMDC también reciben su radio medido (D-014). Se consultan en
// lotes aparte, para que las consultas de las estrellas con nombre sigan siendo las mismas.
const idsConNombre = new Set(conNombre.map(s => s.i));
// Solo con una distancia de Hoshi buena: curada, o respaldada por una paralaje de Gaia DR3 o de Hipparcos 2007 con error
// ≤ 10 % (paralaje/σ ≥ 10, la regla de distancia del catálogo) que calce con ella (diferencia ≤ 10 %).
const csvGz = ruta => parse(zlib.gunzipSync(fs.readFileSync(ruta)).toString('utf8'), { columns: true, skip_empty_lines: true });
const registroHsb = new Map(parse(fs.readFileSync('data/catalog/hsb_registro.csv', 'utf8'), { columns: true }).map(f => [Number(f.hsb), f]));
const fuenteDistancia = new Map(csvGz('data/catalog/hsb_fuentes.csv.gz').map(f => [Number(f.hsb), f.fuente_d]));
const gaiaRegistro = await leerGaiaRegistro();
const hipparcos = new Map(csvGz('data/raw/hipparcos/hipparcos_2007.csv.gz').map(h => [Number(h.hip), h]));
const curadas = new Set(DISTANCIAS_CURADAS.map(c => c.i));
function distanciaBuena(star) {
  if (curadas.has(star.i) || /curada/.test(fuenteDistancia.get(star.i) || '')) return true;
  const r = registroHsb.get(star.i), g = r?.gaia_dr3 && gaiaRegistro.get(r.gaia_dr3), h = r?.hip && hipparcos.get(Number(r.hip));
  return [[g?.parallax, g?.parallax_error], [h?.plx, h?.e_plx]].some(([p, e]) => Number(p) > 0 && Number(e) > 0
    && Number(p) / Number(e) >= 10 && Math.abs(1000 / Number(p) - star.d) / star.d <= 0.1);
}
const conDiametroTodas = todas.filter(s => !idsConNombre.has(s.i) && s.n !== 'Sol' && jmdc.has(hdDe(s)));
const conDiametro = conDiametroTodas.filter(distanciaBuena);
console.log(`Sin nombre con diámetro del JMDC: ${conDiametroTodas.length}; con distancia buena: ${conDiametro.length}`);
for (const s of conDiametroTodas.filter(s => !conDiametro.includes(s))) console.log(`Distancia sin respaldo (paralaje/σ < 10 o no calza): HD ${hdDe(s)} a ${s.d} pc (${fuenteDistancia.get(s.i)})`);
const nombradasSinRespaldo = conNombre.filter(s => jmdc.has(hdDe(s)) && !distanciaBuena(s));
console.log(`Con nombre y diámetro del JMDC cuya distancia no pasaría el umbral: ${nombradasSinRespaldo.length} (${nombradasSinRespaldo.map(s => s.n).join(', ')})`);
const stars = [...conNombre, ...conDiametro];
// Radio medido = diámetro angular × distancia del catálogo; no en binarias, donde la medida mezcla dos estrellas.
// Binaria: un «+» seguido de otro tipo espectral («A0V+G5III», «M3+M4», «dM3+dM4»); el «+» de subtipo («K2+III») no cuenta.
const BINARIA = /\+\s*(?:sd|d|g|c)?[OBAFGKMLTYWCSD]/;
// Números de la cita como en la ficha: hasta 3 decimales, sin ceros sobrantes y con coma decimal.
const cifra = (valor, decimales = 3) => Number(valor).toLocaleString('es-CL', { maximumFractionDigits: decimales });
// `tipos`: el de SIMBAD y el del catálogo, cada uno por separado (juntos, «G0V+ G0V» parecería una binaria).
const radioJmdc = (medida, distanciaPc, tipos = []) => medida && distanciaPc > 0 && !tipos.some(t => BINARIA.test(t || ''))
  ? { radiusSolar: 0.1075 * medida.ld * distanciaPc, fuente: `JMDC (Duvert 2016), ${medida.bibcode}; diámetro ${cifra(medida.ld)} ± ${cifra(medida.error)} mas (${medida.metodo}) × distancia del catálogo, ${cifra(distanciaPc, 1)} pc` } : null;
const hipDe = star => { const a = (busqueda.get(star.i) || []).find(alias => /^HIP \d+$/.test(alias)); return a ? Number(a.slice(4)) : null; };
// Consulta de un grupo de estrellas: identificadores, TIC, Gaia y SIMBAD.
const nombresDe = lista => lista.map(star => [star.i, [...(busqueda.get(star.i) || []).filter(alias => /^(HIP|HD|HR|Gl|GJ) /.test(alias)).map(alias => alias.replace(/^Gl /, 'GJ ').replace(/([A-Z])$/, ' $1')),
  ...(busqueda.get(star.i) || []).filter(alias => /^(HIP|HD|HR|Gl|GJ) /.test(alias)).map(alias => alias.replace(/^Gl /, 'GJ ')), ...(star.n ? [`NAME ${star.n}`, star.n] : [])].filter(nombre => /^[\x20-\x7e]+$/.test(nombre))]);
// `sinTic`: sin consultar el TIC (MAST). El grupo nuevo no lo necesita para su radio (diámetro × distancia) y MAST
// cortaba sus consultas por tiempo: su temperatura sale de Gaia DR3 o de SIMBAD.
async function consultar(lista, { sinTic = false } = {}) {
  const hips = [...new Set(lista.map(hipDe).filter(Boolean))];
  const [ticFilas, simbadFilas] = [sinTic ? new Map() : await tic(hips), await simbad(hips)];
  const gaiaDe = await gaiaPorNombres(nombresDe(lista));
  const ticGaia = sinTic ? new Map() : await ticPorGaia([...new Set(gaiaDe.values())]);
  const gaiaFilas = await gaia([...new Set([...gaiaDe.values(), ...[...ticFilas.values()].map(f => f.GAIA).filter(Boolean).map(String)])]);
  return { ticFilas, simbadFilas, gaiaDe, ticGaia, gaiaFilas };
}
const nasa = await exoplanetArchive();
const [deNombre, deDiametro] = [await consultar(conNombre), conDiametro.length ? await consultar(conDiametro, { sinTic: true }) : null];
// Lo de las estrellas con nombre manda; lo del grupo nuevo solo completa lo que falta.
const unir = clave => { const m = new Map(deNombre[clave]); for (const [k, v] of deDiametro?.[clave] || []) if (!m.has(k)) m.set(k, v); return m; };
const [ticFilas, simbadFilas, gaiaDe, ticGaia, gaiaFilas] = ['ticFilas', 'simbadFilas', 'gaiaDe', 'ticGaia', 'gaiaFilas'].map(unir);
const soloDiametro = new Set(conDiametro.map(s => s.i));
const datos = {};
for (const star of stars) {
  const hip = hipDe(star), idGaia = gaiaDe.get(star.i), conRadio = fila => fila?.rad ? fila : null;
  const t = conRadio(ticFilas.get(hip)) || ticGaia.get(idGaia) || ticFilas.get(hip);
  const g = gaiaFilas.get(idGaia) || (t && gaiaFilas.get(String(t.GAIA))), s = simbadFilas.get(hip);
  const medido = radioJmdc(jmdc.get(hdDe(star)), star.d, [s?.sp_type, star.sp]);
  // Un diámetro que da más del doble o menos de la mitad del radio de catálogo suele ser otra estrella
  // mal enlazada o una medida antigua dudosa: se deja el de catálogo y se avisa para revisarlo.
  const catalogo = t?.rad || g?.radius_flame || nasa.get(hip)?.radiusSolar;
  if (medido && catalogo && (medido.radiusSolar / catalogo > 2 || medido.radiusSolar / catalogo < 0.5)) { console.warn(`JMDC dudoso: ${star.n ?? `HD ${hdDe(star)}`} ${medido.radiusSolar.toFixed(1)} frente a ${Number(catalogo).toFixed(1)} R☉`); medido.radiusSolar = null; }
  // Una estrella sin nombre entra solo con su radio medido; si se descartó, no se agregan sus otros datos. Tampoco si es
  // anfitriona de planetas y su radio del NASA Exoplanet Archive difiere en más de 15 %: dos medidas que no calzan, decide Sergio.
  const radioNasa = nasa.get(hip)?.radiusSolar;
  if (soloDiametro.has(star.i) && medido?.radiusSolar && radioNasa && Math.abs(medido.radiusSolar / radioNasa - 1) > 0.15) {
    console.warn(`JMDC frente a NASA: HD ${hdDe(star)} ${medido.radiusSolar.toFixed(2)} frente a ${radioNasa} R☉ (no se agrega)`);
    continue;
  }
  if (soloDiametro.has(star.i) && !medido?.radiusSolar) continue;
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
console.log(`${conNombre.length} con nombre y ${conDiametro.length} sin nombre con diámetro del JMDC · ${con} con radio y temperatura · ${Object.keys(datos).length - con} sin ellos`);
for (const n of ['Mintaka', 'Betelgeuse', 'Rigel', 'Sirius', "Luyten's Star", 'Rigil Kentaurus', 'Toliman', 'Proxima Centauri', 'Vega', 'Dziban', 'Dziban B']) {
  const s = stars.find(x => x.n === n);
  console.log(n, JSON.stringify(s && datos[s.i]));
}
