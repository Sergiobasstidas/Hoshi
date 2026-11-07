// scripts/catalogo.mjs
// Arma el catálogo de estrellas con un solo comando, en orden fijo y sin red:
//   npm run catalogo                      regenera todo desde data/raw y data/catalog
//   npm run catalogo -- --desde-cero      borra antes las salidas regenerables (comprueba que no dependen de sí mismas)
//   npm run catalogo -- --con-pendientes  corre también los pasos cuya descarga nueva aún no se adopta (ver PENDIENTES)
//   npm run descargar:red                 igual, pero los pasos con consultas externas vuelven a descargar
//                                         (HOSHI_RED=descargar, ver scripts/catalog/red.js)
//
// Orden y por qué:
//  1. process_stars (pasada 1). process_exoplanets y build_star_identity solo usan stars_15pc.json para saber
//     qué filas de AT-HYG tienen distancia, y eso no depende de los parches; esta pasada deja esa lista lista
//     aunque no exista una anterior.
//  2. process_exoplanets → build_star_identity → build_distance_corrections → build_added_hosts: cruces con
//     NASA y Gaia y los parches del catálogo.
//  3. process_stars (pasada 2), ahora con distancias corregidas y anfitrionas añadidas.
//  4. Lo que lee stars_15pc.json: buscador, binarias, escena de exoplanetas y descubrimientos.
//  5. Pasos con consultas guardadas en data/raw/red: Gaia según SIMBAD, JMDC, alias del buscador, datos
//     oficiales, fichas y cúmulos (cúmulos usa además data/raw/ucc, local).
//  6. Capa del millón de Gaia (usa las binarias y la identidad) y, al final, el registro HSB.
//
// Las fechas «generado» y «descargado» de las salidas no se reescriben si el resto del archivo no cambió.

import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const PASOS = [
  { script: 'scripts/process_stars.js', salidas: ['data/processed/stars_15pc.json'] },
  { script: 'scripts/exoplanets/process_exoplanets.js', salidas: ['data/exoplanets/exoplanet_systems.json', 'data/exoplanets/crossmatch_report.json'] },
  { script: 'scripts/catalog/build_star_identity.js', salidas: ['data/catalog/star_identity.json', 'data/catalog/exoplanet_host_identity.json', 'data/catalog/catalog_report.json'] },
  { script: 'scripts/catalog/build_distance_corrections.js', salidas: ['data/catalog/distance_corrections.json'] },
  { script: 'scripts/catalog/build_added_hosts.js', salidas: ['data/catalog/added_hosts.json'] },
  { script: 'scripts/process_stars.js', salidas: ['data/processed/stars_15pc.json'] },
  { script: 'scripts/process_star_search.js', salidas: ['public/data/star-search.json'] },
  { script: 'scripts/process_binaries.js', salidas: ['data/processed/star_systems.json'] },
  { script: 'scripts/exoplanets/build_planet_scene.js', salidas: ['public/data/exoplanets.json', 'data/exoplanets/planet_scene_report.json'] },
  { script: 'scripts/exoplanets/build_discoveries.js', salidas: ['public/data/exoplanet-discoveries.json', 'data/exoplanets/discoveries_report.json'] },
  { script: 'scripts/catalog/build_gaia_simbad.js', salidas: ['data/catalog/gaia_simbad.json'], red: true },
  { script: 'scripts/catalog/build_jmdc.js', salidas: ['data/catalog/jmdc_diametros.json'], red: true },
  { script: 'scripts/process_star_aliases.js', salidas: ['public/data/star-search-variables.json', 'public/data/star-search-numeros.json'], red: true },
  { script: 'scripts/process_stellar_official.js', salidas: ['data/processed/stellar_official.json'], red: true, pendiente: true },
  { script: 'scripts/process_fichas.js', salidas: ['public/data/fichas.json'], red: true, pendiente: true },
  { script: 'scripts/process_cumulos.js', salidas: ['public/data/cumulos.json'], red: true },
  { script: 'scripts/process_gaia.js', salidas: ['public/data/gaia-1m.bin'] },
  { script: 'scripts/catalog/build_hsb.js', salidas: ['data/catalog/hsb_registro.csv', 'data/catalog/hsb_companeras_dibujadas.csv'] },
];
// PENDIENTES: la descarga del 07/11/2026 cambia valores frente a las salidas del 04/11/2026 (la NASA actualizó
// parámetros de anfitrionas y 8 consultas a MAST se agotan por tiempo). Se adoptan cuando Sergio revise las
// capturas; hasta entonces estas salidas quedan como están.

const argumentos = new Set(process.argv.slice(2));
const descargar = argumentos.has('--descargar');
const conPendientes = argumentos.has('--con-pendientes') || descargar;
const pasos = PASOS.filter(p => conPendientes || !p.pendiente);

// Fechas que cambian en cada corrida aunque el contenido sea el mismo.
const sinFechas = texto => {
  try {
    return JSON.stringify(JSON.parse(texto), (k, v) => (k === 'generado' || k === 'descargado' ? undefined : v));
  } catch {
    return null;
  }
};

const salidas = [...new Set(pasos.flatMap(p => p.salidas))];
const antes = new Map(salidas.filter(f => fs.existsSync(f)).map(f => [f, fs.readFileSync(f)]));
// El registro HSB no es una salida regenerable: es la fuente de los números y nunca se borra.
if (argumentos.has('--desde-cero')) for (const f of salidas) if (!f.endsWith('hsb_registro.csv')) fs.rmSync(f, { force: true });

const inicio = Date.now();
for (const [k, paso] of pasos.entries()) {
  const t = Date.now();
  const env = { ...process.env, ...(descargar && paso.red ? { HOSHI_RED: 'descargar' } : {}) };
  const r = spawnSync(process.execPath, [paso.script], { env, encoding: 'utf8', maxBuffer: 1 << 26 });
  const ultima = `${r.stdout}${r.stderr}`.trim().split('\n').filter(Boolean).pop() || '';
  console.log(`${String(k + 1).padStart(2)}. ${paso.script} (${((Date.now() - t) / 1000).toFixed(1)} s) ${ultima.slice(0, 110)}`);
  if (r.status !== 0) {
    console.error(`${r.stdout}\n${r.stderr}`);
    console.error(`✗ Falló ${paso.script}`);
    process.exit(1);
  }
}
for (const p of PASOS.filter(p => p.pendiente && !conPendientes)) console.log(`   (sin correr, pendiente de revisión: ${p.script})`);

let iguales = 0, soloFecha = 0;
const cambiados = [];
for (const f of salidas) {
  const previo = antes.get(f);
  if (!previo || !fs.existsSync(f)) { cambiados.push(f); continue; }
  const ahora = fs.readFileSync(f);
  if (ahora.equals(previo)) iguales++;
  else if (sinFechas(ahora.toString('utf8')) !== null && sinFechas(ahora.toString('utf8')) === sinFechas(previo.toString('utf8'))) {
    fs.writeFileSync(f, previo);
    soloFecha++;
  } else cambiados.push(f);
}
console.log(`✓ Catálogo en ${((Date.now() - inicio) / 1000).toFixed(0)} s: ${iguales} salidas iguales, ${soloFecha} con solo la fecha distinta (conservada), ${cambiados.length} cambiadas`);
for (const f of cambiados) console.log(`  cambió: ${f}`);
