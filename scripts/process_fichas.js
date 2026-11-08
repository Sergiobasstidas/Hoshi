// Datos ampliados de las fichas, sin calcular nada: NASA Exoplanet Archive para planetas y sus
// estrellas, y Gaia DR3 para las estrellas con nombre. Las consultas se guardan en data/raw/red/fichas
// (ver scripts/catalog/red.js). Escribe
// public/data/fichas.json, que la app carga solo al abrir una ficha.
import fs from 'node:fs';
import { empezarDescarga, pedir } from './catalog/red.js';

const SIMBAD = 'https://simbad.harvard.edu/simbad/sim-tap/sync';
const GAIA = 'https://gea.esac.esa.int/tap-server/tap/sync';
const numero = valor => (valor === undefined || valor === '' || !Number.isFinite(Number(valor)) ? undefined : Number(valor));
// Lotes en orden fijo (números y nombres ordenados), así las consultas no dependen del orden del catálogo
// (por distancia) y se pueden repetir sin red con lo guardado en data/raw/red.
const ordenFijo = lista => [...lista].sort((a, b) => String(a).length - String(b).length || (String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0));
const en = (lista, n) => { const orden = ordenFijo(lista); return Array.from({ length: Math.ceil(orden.length / n) }, (_, i) => orden.slice(i * n, i * n + n)); };
function csv(texto) {
  const filas = texto.trim().split('\n').map(linea => linea.match(/("([^"]*)"|[^,]*)(,|$)/g).map(c => c.replace(/,$/, '').replace(/^"|"$/g, '')));
  const [cabecera, ...resto] = filas;
  return resto.map(fila => Object.fromEntries(cabecera.map((c, i) => [c, fila[i]])));
}
async function tap(url, query) {
  const texto = await pedir('fichas', url, { signal: AbortSignal.timeout(180000), method: 'POST',
    body: new URLSearchParams({ request: 'doQuery', lang: 'adql', format: 'csv', query }), aceptar: (t, r) => r.ok && !t.startsWith('<') });
  if (texto.startsWith('<')) throw Error(`${url}: ${(texto.match(/QUERY_STATUS[^<]*/) || [texto.slice(0, 200)])[0]}`);
  return csv(texto);
}
const limpio = objeto => Object.fromEntries(Object.entries(objeto).filter(([, valor]) => valor !== undefined && valor !== ''));

const columnas = 'pl_name,hostname,gaia_dr3_id,discoverymethod,disc_year,disc_facility,pl_dens,pl_insol,pl_eqt,pl_orbeccen,pl_bmassprov,pl_radeerr1,pl_bmasseerr1,pl_orbpererr1,pl_trandur,pl_trandep,st_age,st_met,st_logg,st_rotp,st_radv,sy_pmra,sy_pmdec,sy_plx,sy_plxerr1,st_lum';
empezarDescarga('fichas');
const textoNasa = await pedir('fichas', `https://exoplanetarchive.ipac.caltech.edu/TAP/sync?format=csv&query=${encodeURIComponent(`select ${columnas} from pscomppars`)}`, { signal: AbortSignal.timeout(300000) });
const planetas = {}, anfitrionas = {};
const estrellaNasa = f => limpio({ edad: numero(f.st_age), metalicidad: numero(f.st_met), gravedad: numero(f.st_logg), rotacion: numero(f.st_rotp), radial: numero(f.st_radv),
  pmRa: numero(f.sy_pmra), pmDec: numero(f.sy_pmdec), paralaje: numero(f.sy_plx), paralajeError: numero(f.sy_plxerr1), gaia: f.gaia_dr3_id?.replace('Gaia DR3 ', ''),
  luminosidad: f.st_lum === '' ? undefined : Number((10 ** Number(f.st_lum)).toPrecision(4)) });
if (!textoNasa.startsWith('pl_name')) throw Error(`NASA: ${textoNasa.slice(0, 300)}`);
for (const f of csv(textoNasa)) {
  planetas[f.pl_name] = limpio({ metodo: f.discoverymethod, ano: numero(f.disc_year), telescopio: f.disc_facility, densidad: numero(f.pl_dens), insolacion: numero(f.pl_insol), equilibrio: numero(f.pl_eqt),
    excentricidad: numero(f.pl_orbeccen), tipoMasa: f.pl_bmassprov, errorRadio: numero(f.pl_radeerr1), errorMasa: numero(f.pl_bmasseerr1), errorPeriodo: numero(f.pl_orbpererr1), transito: numero(f.pl_trandur), profundidad: numero(f.pl_trandep) });
  anfitrionas[f.hostname] ||= estrellaNasa(f);
}

const stars = JSON.parse(fs.readFileSync('data/processed/stars_15pc.json', 'utf8')).filter(s => s.n && s.n !== 'Sol');
const busqueda = new Map(JSON.parse(fs.readFileSync('public/data/star-search.json', 'utf8')));
const hipDe = new Map(stars.flatMap(s => { const a = (busqueda.get(s.i) || []).find(alias => /^HIP \d+$/.test(alias)); return a ? [[a, s.i]] : []; }));
const gaiaDe = new Map();
for (const grupo of en([...hipDe.keys()], 150)) {
  for (const f of await tap(SIMBAD, `SELECT i.id AS hip, j.id AS gaia FROM ident AS i JOIN ident AS j ON j.oidref = i.oidref WHERE i.id IN (${grupo.map(h => `'${h}'`).join(',')}) AND j.id LIKE 'Gaia DR3 %'`)) {
    gaiaDe.set(f.gaia.replace('Gaia DR3 ', ''), hipDe.get(f.hip.replace(/\s+/g, ' ')));
  }
}
const estrellas = {};
for (const grupo of en([...gaiaDe.keys()], 200)) {
  const ids = grupo.join(',');
  const [fuente, parametros] = await Promise.all([
    tap(GAIA, `SELECT source_id,parallax,parallax_error,pmra,pmdec,radial_velocity FROM gaiadr3.gaia_source WHERE source_id IN (${ids})`),
    tap(GAIA, `SELECT source_id,age_flame,mh_gspphot,logg_gspphot,evolstage_flame FROM gaiadr3.astrophysical_parameters WHERE source_id IN (${ids})`),
  ]);
  const ap = new Map(parametros.map(f => [f.source_id, f]));
  for (const f of fuente) {
    const a = ap.get(f.source_id) || {};
    estrellas[gaiaDe.get(f.source_id)] = limpio({ gaia: f.source_id, paralaje: numero(f.parallax), paralajeError: numero(f.parallax_error), pmRa: numero(f.pmra), pmDec: numero(f.pmdec), radial: numero(f.radial_velocity),
      edad: numero(a.age_flame), metalicidad: numero(a.mh_gspphot), gravedad: numero(a.logg_gspphot), etapa: numero(a.evolstage_flame) });
  }
}
fs.writeFileSync('public/data/fichas.json', JSON.stringify({ planetas, anfitrionas, estrellas }));
console.log(`${Object.keys(planetas).length} planetas · ${Object.keys(anfitrionas).length} anfitrionas · ${Object.keys(estrellas).length} estrellas con nombre en Gaia`);
