// Datos físicos de las estrellas con nombre desde catálogos oficiales, sin calcular nada:
// NASA Exoplanet Archive, tabla curada de brillantes (citas de Wikipedia a sus artículos),
// TESS Input Catalog v8.2 (MAST), Gaia DR3 y SIMBAD. Por cada dato vale la primera fuente
// que lo tenga. Se ejecuta a mano y escribe data/processed/stellar_official.json.
import fs from 'node:fs';

// Brillantes que Gaia y TIC saturan: nombre en Hoshi → [página, componente en su recuadro].
const CURADAS = Object.fromEntries(['Mintaka', 'Alnitak', 'Alnilam', 'Rigel', 'Betelgeuse', 'Deneb', 'Saiph', 'Bellatrix', 'Sirius', 'Canopus', 'Arcturus', 'Vega', 'Capella', 'Procyon', 'Achernar', 'Altair', 'Aldebaran', 'Antares', 'Spica', 'Pollux', 'Fomalhaut', 'Regulus', 'Polaris', 'Castor', 'Acrux', 'Hadar', 'Shaula', 'Adhara', 'Mimosa', 'Gacrux', 'Algol', 'Mizar', 'Alcor', 'Dubhe', 'Alioth', 'Alkaid', 'Sadr', 'Wezen', 'Mirfak', 'Elnath', 'Albireo']
  .map(nombre => [nombre, [nombre, 0]]).concat([['Rigil Kentaurus', ['Alpha_Centauri', 0]], ['Proxima Centauri', ['Proxima_Centauri', 0]]]));
const SIMBAD = 'https://simbad.harvard.edu/simbad/sim-tap/sync';
const en = (lista, n) => Array.from({ length: Math.ceil(lista.length / n) }, (_, i) => lista.slice(i * n, i * n + n));
const positivo = valor => { const n = Number(valor); return valor !== null && valor !== '' && Number.isFinite(n) && n > 0 ? n : null; };

function csv(texto) {
  const filas = texto.trim().split('\n').map(linea => linea.match(/("([^"]*)"|[^,]*)(,|$)/g).map(c => c.replace(/,$/, '').replace(/^"|"$/g, '')));
  const [cabecera, ...resto] = filas;
  return resto.map(fila => Object.fromEntries(cabecera.map((c, i) => [c, fila[i]])));
}
async function tap(url, query, lang = 'ADQL') {
  const r = await fetch(url, { method: 'POST', body: new URLSearchParams({ request: 'doQuery', lang, format: 'csv', query }) });
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
    const r = await fetch('https://mast.stsci.edu/api/v0/invoke', { method: 'POST', body: new URLSearchParams({ request }) });
    for (const f of (await r.json()).data || []) filas.set(Number(f.HIP), f);
  }
  return filas;
}
async function gaia(ids) {
  const filas = new Map();
  for (const grupo of en(ids, 200)) {
    const lista = await tap('https://gea.esac.esa.int/tap-server/tap/sync', `SELECT source_id,teff_gspphot,radius_flame,mass_flame,lum_flame FROM gaiadr3.astrophysical_parameters WHERE source_id IN (${grupo.join(',')})`);
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
  }
  return filas;
}
// Valor central del recuadro de Wikipedia, de la componente pedida. Se piden todas las páginas
// de una sola vez, para no saturar su API.
async function paginasWikipedia(titulos) {
  const r = await fetch(`https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&prop=revisions&rvprop=content&rvslots=main&redirects=1&titles=${encodeURIComponent(titulos.join('|'))}`,
    { headers: { 'User-Agent': 'Hoshi/1.0 (https://hoshi-map.pages.dev)' } });
  const respuesta = await r.text();
  if (!respuesta.startsWith('{')) throw Error(`Wikipedia: ${respuesta.slice(0, 120)}`);
  const { query } = JSON.parse(respuesta);
  const destino = new Map([...(query.normalized || []), ...(query.redirects || [])].map(({ from, to }) => [from, to]));
  const textos = new Map(query.pages.map(pagina => [pagina.title, pagina.revisions?.[0].slots.main.content || '']));
  return titulo => {
    let actual = titulo;
    while (destino.has(actual)) actual = destino.get(actual);
    return textos.get(actual) || '';
  };
}
function datosWikipedia(texto, componente) {
  const leer = campo => {
    const valores = [...texto.matchAll(new RegExp(`\\|\\s*${campo}\\s*=\\s*(?:\\{\\{(?:val|Val|solar[^|]*)\\|)?(?:[~≈]\\s*)?([\\d.,]+)`, 'g'))];
    return valores[componente] ? positivo(valores[componente][1].replace(/,/g, '')) : null;
  };
  return { temperatureK: leer('temperature'), radiusSolar: leer('radius'), massSolar: leer('mass'), luminositySolar: leer('luminosity') };
}

const FUENTE = { nasa: 'NASA Exoplanet Archive', curada: 'Wikipedia, según sus artículos citados', tic: 'TESS Input Catalog v8.2 (MAST)', gaia: 'Gaia DR3', simbad: 'SIMBAD' };
const stars = JSON.parse(fs.readFileSync('data/processed/stars_15pc.json', 'utf8')).filter(s => s.n && s.n !== 'Sol');
const busqueda = new Map(JSON.parse(fs.readFileSync('public/data/star-search.json', 'utf8')));
const hipDe = star => { const a = (busqueda.get(star.i) || []).find(alias => /^HIP \d+$/.test(alias)); return a ? Number(a.slice(4)) : null; };
const hips = [...new Set(stars.map(hipDe).filter(Boolean))];
const [nasa, ticFilas, simbadFilas] = [await exoplanetArchive(), await tic(hips), await simbad(hips)];
const gaiaFilas = await gaia([...ticFilas.values()].map(f => f.GAIA).filter(Boolean));
const curadas = {};
const titulos = [...new Set(Object.values(CURADAS).map(([titulo]) => titulo))];
const leerPagina = await paginasWikipedia(titulos.slice(0, 50));
for (const [nombre, [titulo, componente]] of Object.entries(CURADAS)) curadas[nombre] = datosWikipedia(leerPagina(titulo), componente);

const datos = {};
for (const star of stars) {
  const hip = hipDe(star), t = ticFilas.get(hip), g = t && gaiaFilas.get(String(t.GAIA)), s = simbadFilas.get(hip);
  const capas = [
    ['nasa', nasa.get(hip)], ['curada', curadas[star.n]],
    ['tic', t && { temperatureK: positivo(t.Teff), radiusSolar: positivo(t.rad), massSolar: positivo(t.mass), luminositySolar: positivo(t.lum) }],
    ['gaia', g && { temperatureK: positivo(g.teff_gspphot), radiusSolar: positivo(g.radius_flame), massSolar: positivo(g.mass_flame), luminositySolar: positivo(g.lum_flame) }],
    ['simbad', s && { temperatureK: positivo(s.teff), espectro: s.sp_type || null }],
  ];
  const fila = { fuentes: {} };
  for (const campo of ['temperatureK', 'radiusSolar', 'massSolar', 'luminositySolar', 'espectro']) {
    for (const [fuente, capa] of capas) if (capa?.[campo]) { fila[campo] = capa[campo]; fila.fuentes[campo] = FUENTE[fuente]; break; }
  }
  if (Object.keys(fila.fuentes).length) datos[star.i] = fila;
}
fs.writeFileSync('data/processed/stellar_official.json', JSON.stringify(datos) + '\n');
const con = Object.values(datos).filter(d => d.radiusSolar && d.temperatureK).length;
console.log(`${stars.length} con nombre · ${con} con radio y temperatura · ${stars.length - con} sin ellos`);
for (const n of ['Mintaka', 'Betelgeuse', 'Rigel', 'Sirius', "Luyten's Star", 'Rigil Kentaurus', 'Toliman', 'Proxima Centauri', 'Vega', 'Dziban', 'Dziban B']) {
  const s = stars.find(x => x.n === n);
  console.log(n, JSON.stringify(s && datos[s.i]));
}
