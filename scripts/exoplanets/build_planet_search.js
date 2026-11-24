// scripts/exoplanets/build_planet_search.js
// Nombres de los exoplanetas que dibuja Hoshi (public/data/exoplanets.json) para el buscador, en
// public/data/planet-search.json. En el navegador (src/scene/buscarPlanetas.js) cada planeta se encuentra por su
// nombre, por sus nombres propios y por cada nombre de su estrella seguido de su letra («Gliese 436 b», «Ross 905 b»).
// Fuentes, por estrella anfitriona (por su nombre en la NASA, `hostname`):
//  - servicio de alias del NASA Exoplanet Archive (nph-aliaslookup.py), una consulta por sistema, guardada por red.js
//    (paso «nasa_alias»): nombres de la estrella y de cada planeta, con el nombre IAU (Awohali) y los TIC/TOI .01;
//  - identificadores de la NASA (HD, HIP, TIC, Gaia DR2 y DR3) y los de SIMBAD de data/catalog/exoplanet_host_identity.json;
//  - exoplanet.eu (otros nombres de la estrella y del planeta), KOI de Kepler, EPIC de K2 y TOI de TESS (por TIC y período).
// La letra de cada planeta es pl_letter de la NASA.
// Formato: [[id de la estrella, [nombres de la estrella que no están en star-search.json],
//   [[nombre del planeta, letra, [nombres propios que no son «nombre de la estrella + letra»]], …], componente], …].
// `componente`: la letra de la estrella anfitriona cuando es una componente de un sistema múltiple («B» en HD 41004 B),
// o '' (buscarPlanetas.js solo arma «nombre de la estrella + letra» con los nombres de esa componente).
// Uso: node scripts/exoplanets/build_planet_search.js (con HOSHI_RED=descargar consulta el servicio de alias; si falta
// la respuesta de un sistema, se arma con las otras fuentes y se cuenta).
import fs from 'node:fs';
import { parse } from 'csv-parse/sync';
import { pedir } from '../catalog/red.js';
import { normalizeStarQuery } from '../../src/scene/starSearch.js';

const RAW = './data/raw/exoplanets';
const SALIDA = './public/data/planet-search.json';
const PASO = 'nasa_alias';
const CONCURRENCIA = Number(process.env.HOSHI_ALIAS_CONCURRENCIA || 3);
const leer = archivo => fs.existsSync(`${RAW}/${archivo}`) ? parse(fs.readFileSync(`${RAW}/${archivo}`, 'utf8'), { columns: true, skip_empty_lines: true, comment: '#', relax_quotes: true }) : [];
// Nombres internos de Hoshi o de catálogos base que no nombran estrellas fuera de Hoshi.
const INTERNO = /^(AT-HYG|HSB|HYG) /;
const limpio = n => n.replace(/^NAME(-IAU)? /, '').replace(/\s+/g, ' ').trim();

const sistemas = JSON.parse(fs.readFileSync('./public/data/exoplanets.json', 'utf8')).systems;
const nombresBuscador = new Map(JSON.parse(fs.readFileSync('./public/data/star-search.json', 'utf8')).map(([id, nombres]) => [id, nombres]));
if (fs.existsSync('./public/data/star-search-variables.json')) {
  for (const [id, nombres] of JSON.parse(fs.readFileSync('./public/data/star-search-variables.json', 'utf8'))) nombresBuscador.set(id, [...(nombresBuscador.get(id) || []), ...nombres]);
}

// Planeta de la NASA: su anfitriona y su letra.
const nasa = new Map();
for (const f of leer('nasa_pscomppars.csv')) nasa.set(f.pl_name, { host: f.hostname, letra: f.pl_letter, tic: null, P: Number(f.pl_orbper) });
for (const f of leer('nasa_pscomppars_ids.csv')) if (nasa.has(f.pl_name)) nasa.get(f.pl_name).ids = [f.hd_name, f.hip_name, f.tic_id, f.gaia_dr2_id, f.gaia_dr3_id];
for (const [, p] of nasa) p.tic = (p.ids?.[2] || '').replace(/^TIC /, '') || null;

// Nombres por estrella (hostname de la NASA) y por planeta (pl_name).
const deEstrella = new Map(), dePlaneta = new Map();
const sumar = (mapa, clave, nombres) => {
  if (!clave) return;
  if (!mapa.has(clave)) mapa.set(clave, new Set());
  for (const n of nombres) if (n && n.trim()) mapa.get(clave).add(limpio(n));
};
for (const [nombre, p] of nasa) { sumar(deEstrella, p.host, [p.host, ...(p.ids || [])]); sumar(dePlaneta, nombre, [nombre]); }
const identidad = JSON.parse(fs.readFileSync('./data/catalog/exoplanet_host_identity.json', 'utf8')).hosts;
for (const h of identidad) sumar(deEstrella, h.h, h.alias || []);
const hostDePlaneta = nombre => nasa.get(nombre)?.host;
for (const f of leer('exoplaneteu_catalog.csv')) {
  if (!nasa.has(f.name)) continue;
  sumar(deEstrella, hostDePlaneta(f.name), [f.star_name, ...(f.star_alternate_names || '').split(',')]);
  sumar(dePlaneta, f.name, (f.alternate_names || '').split(','));
}
for (const f of leer('nasa_k2pandc.csv')) if (f.epic_hostname && nasa.has(f.pl_name)) sumar(deEstrella, hostDePlaneta(f.pl_name), [f.epic_hostname]);
for (const f of leer('nasa_koi_cumulative.csv')) {
  const [, numero, planeta] = /^K0*(\d+)\.(\d+)$/.exec(f.kepoi_name || '') || [];
  if (f.kepler_name && numero) sumar(dePlaneta, f.kepler_name, [f.kepoi_name, `KOI-${numero}.${planeta}`]);
}
const tois = new Map();
for (const f of leer('nasa_toi.csv')) { if (!tois.has(f.tid)) tois.set(f.tid, []); tois.get(f.tid).push(f); }
for (const [nombre, p] of nasa) {
  for (const t of tois.get(p.tic) || []) if (p.P && Math.abs(Number(t.pl_orbper) - p.P) / p.P < 0.01) sumar(dePlaneta, nombre, [`TOI-${t.toi}`]);
}

// Servicio de alias de la NASA, por anfitriona de los sistemas que dibuja Hoshi.
const hosts = [...new Set(sistemas.flatMap(s => s.p.map(p => hostDePlaneta(p.n)).filter(Boolean)))];
let sinAlias = 0;
async function alias(host) {
  const url = `https://exoplanetarchive.ipac.caltech.edu/cgi-bin/Lookup/nph-aliaslookup.py?objname=${encodeURIComponent(host)}`;
  let datos;
  try {
    datos = JSON.parse(await pedir(PASO, url, { soloSiFalta: true, signal: AbortSignal.timeout(120000), aceptar: (t, r) => r.ok && t.trim().startsWith('{') }));
  } catch { sinAlias++; return; }
  for (const estrella of Object.values(datos.system?.objects?.stellar_set?.stars || {})) {
    if (estrella.is_host === 'True' || estrella.requested_object === 'True') sumar(deEstrella, host, estrella.alias_set?.aliases || []);
  }
  for (const [nombre, planeta] of Object.entries(datos.system?.objects?.planet_set?.planets || {})) sumar(dePlaneta, nombre, planeta.alias_set?.aliases || []);
}
const cola = [...hosts];
let hechos = 0;
await Promise.all(Array.from({ length: CONCURRENCIA }, async () => {
  while (cola.length) {
    await alias(cola.shift());
    if (++hechos % 200 === 0) console.log(`  alias: ${hechos} de ${hosts.length}`);
  }
}));

const salida = [];
let planetas = 0, nombresPlaneta = 0, nombresEstrella = 0;
for (const sistema of sistemas) {
  const yaEnBuscador = new Set((nombresBuscador.get(sistema.i) || []).map(normalizeStarQuery));
  const propiosEstrella = new Set();
  for (const p of sistema.p) for (const n of deEstrella.get(hostDePlaneta(p.n)) || []) if (!INTERNO.test(n) && !yaEnBuscador.has(normalizeStarQuery(n))) propiosEstrella.add(n);
  const todosEstrella = [...(nombresBuscador.get(sistema.i) || []), ...propiosEstrella, sistema.h];
  const filas = sistema.p.map(p => {
    planetas++;
    const letra = nasa.get(p.n)?.letra || p.n.split(' ').pop();
    const derivados = new Set(todosEstrella.map(n => normalizeStarQuery(`${n} ${letra}`)));
    derivados.add(normalizeStarQuery(p.n));
    const propios = [...new Set([...(dePlaneta.get(p.n) || [])].filter(n => !derivados.has(normalizeStarQuery(n))))];
    nombresPlaneta += propios.length;
    return [p.n, letra, propios];
  });
  nombresEstrella += propiosEstrella.size;
  const componente = / ([A-E])$/.exec(hostDePlaneta(sistema.p[0].n) || '')?.[1] || '';
  salida.push(componente ? [sistema.i, [...propiosEstrella], filas, componente] : [sistema.i, [...propiosEstrella], filas]);
}
const texto = JSON.stringify(salida);
if (!fs.existsSync(SALIDA) || fs.readFileSync(SALIDA, 'utf8') !== texto) fs.writeFileSync(SALIDA, texto);
console.log(`✓ Buscador de planetas: ${planetas} planetas de ${salida.length} estrellas; ${nombresEstrella} nombres de estrella que el buscador no tenía y ${nombresPlaneta} nombres propios de planeta; ${sinAlias} de ${hosts.length} sistemas sin respuesta del servicio de alias`);
