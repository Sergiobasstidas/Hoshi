// scripts/build_capa_busqueda.js
// Archivos del buscador para las estrellas de la capa de fondo, en public/data/capa/ (la app no los baja al abrir):
//   manifiesto.json   cuántas estrellas tiene la capa, tamaño de los trozos y el primer valor de cada trozo
//   datos-N.json      las estrellas en orden de Gaia DR3 (source_id), de a POR_DATOS: source_id (el primero entero y
//                     los demás como diferencia), índice en la capa, HSB, G, paralaje y su error (mas), BP−RP y todos
//                     sus nombres en el orden de la ficha. Sirve para buscar por Gaia DR3 (el manifiesto trae el primer
//                     source_id de cada trozo) y para la ficha; se pide solo al buscar o elegir una estrella
//   nombres-N.json    HD, HR, SAO, BD, CD, CPD, WDS, GJ y HIP con la fila de su estrella en datos y su nombre
//                     principal (p, vacío si es ese mismo), ordenados por su clave de búsqueda y en trozos (una
//                     búsqueda baja solo el trozo donde caería su clave)
//   propios.json      nombres propios y de estrella variable (pocos), con la fila de su estrella en datos
//   tyc-N.json        TYC del cruce oficial de Gaia → fila en datos y nombre principal, en trozos por rango de TYC1
//   hsb-N.json        número HSB → fila en datos, en trozos por rango (el HSB, como diferencia con el anterior)
// La fila es la posición de la estrella en el orden de datos (trozo = fila / POR_DATOS); el índice, su posición en
// public/data/estrellas.bin.gz (capa) y en estrellas-hsb.bin.
// Sin TIC. Fuentes: data/catalog/hsb_capa_nombres.csv.gz, la capa (estrellas-hsb.bin, registro y lotes) y la
// astrometría de data/raw/gaia/gaia_dr3_1m.csv.gz y data/raw/gcns/gcns_main.csv.gz. Distancia de la ficha: 1/paralaje
// (D-014). Uso: node scripts/build_capa_busqueda.js (después de scripts/catalog/capa_nombres.js).
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { parse } from 'csv-parse/sync';
import { SALIDA as NOMBRES, estrellasCapa } from './catalog/capa_nombres.js';
import { normalizeStarQuery } from '../src/scene/starSearch.js';
import { claveCatalogo, ordenNombres, tipoNombre } from '../src/scene/capaNombres.js';

const CARPETA = './public/data/capa';
const GAIA_1M = './data/raw/gaia/gaia_dr3_1m.csv.gz', GCNS = './data/raw/gcns/gcns_main.csv.gz';
export const POR_DATOS = 4096, POR_NUMEROS = 16384;

const leerCsvGz = ruta => parse(zlib.gunzipSync(fs.readFileSync(ruta)).toString('utf8'), { columns: true, skip_empty_lines: true });
const fijo = (v, d = 4) => (Number.isFinite(v) ? Number(v.toFixed(d)) : null);
const comparar = (a, b) => { const x = BigInt(a), y = BigInt(b); return x < y ? -1 : x > y ? 1 : 0; };

// Trozos de una lista ordenada [{clave, ...}]: hasta `max` por trozo, sin partir una misma clave de corte.
function trozos(lista, max, corte = x => x) {
  const salida = [];
  let actual = [];
  for (const fila of lista) {
    if (actual.length >= max && corte(fila) !== corte(actual.at(-1))) { salida.push(actual); actual = []; }
    actual.push(fila);
  }
  if (actual.length) salida.push(actual);
  return salida;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const capa = estrellasCapa();
  const indiceDe = new Map(capa.map((e, k) => [e.hsb, k]));
  const nombresDe = new Map();
  for (const f of parse(zlib.gunzipSync(fs.readFileSync(NOMBRES)).toString('utf8'), { columns: true })) {
    const k = indiceDe.get(Number(f.hsb));
    if (k === undefined) throw new Error(`HSB ${f.hsb} de ${NOMBRES} no está en la capa`);
    nombresDe.set(k, ordenNombres(f.nombres.split('|')));
  }
  // Astrometría y fotometría de Gaia DR3.
  const quiero = new Set(capa.map(e => e.gaia).filter(Boolean)), astro = new Map();
  const num = v => (v === '' || v === undefined ? NaN : Number(v));
  for (const r of leerCsvGz(GAIA_1M)) if (quiero.has(r.source_id)) {
    const plx = num(r.parallax);
    astro.set(r.source_id, { g: num(r.phot_g_mean_mag), plx, err: plx / num(r.parallax_over_error), bpRp: num(r.bp_rp) });
  }
  for (const r of leerCsvGz(GCNS)) if (quiero.has(r.source_id) && !astro.has(r.source_id)) {
    astro.set(r.source_id, { g: num(r.phot_g_mean_mag), plx: num(r.parallax), err: num(r.parallax_error), bpRp: num(r.phot_bp_mean_mag) - num(r.phot_rp_mean_mag) });
  }
  // Orden de datos: por source_id; las pocas sin Gaia, al final, por HSB.
  const orden = capa.map((e, k) => ({ ...e, k })).sort((a, b) => (a.gaia && b.gaia ? comparar(a.gaia, b.gaia) : a.gaia ? -1 : b.gaia ? 1 : a.hsb - b.hsb));
  const filaDe = new Map(orden.map((e, f) => [e.k, f]));
  fs.rmSync(CARPETA, { recursive: true, force: true });
  fs.mkdirSync(CARPETA, { recursive: true });
  const escritos = [];
  const escribir = (nombre, datos) => { const texto = JSON.stringify(datos); fs.writeFileSync(`${CARPETA}/${nombre}`, texto); escritos.push([nombre, texto]); };

  // --- Nombres (sin TYC): catálogo por clave, propios y de variable aparte ---
  const catalogo = [], otros = [];
  for (const [indice, nombres] of nombresDe) for (const n of nombres) {
    const k = filaDe.get(indice);
    const tipo = tipoNombre(n);
    if (tipo === 'TYC') continue;
    if (tipo === 'NAME' || tipo === 'V*') { otros.push([n, k]); continue; }
    const clave = claveCatalogo(n);
    if (clave !== normalizeStarQuery(n)) throw new Error(`Clave rápida distinta de la del buscador: ${n} (${clave} / ${normalizeStarQuery(n)})`);
    catalogo.push([clave, n, k]);
  }
  catalogo.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[2] - b[2]));
  otros.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]));
  const trozosNombres = trozos(catalogo, POR_NUMEROS, f => f[0]);
  // p: el nombre principal de la estrella (el de la ficha), para la lista del buscador; vacío si es el mismo nombre.
  const principalDe = new Map(orden.map((e, f) => [f, (nombresDe.get(e.k) || [])[0] || (e.gaia ? `Gaia DR3 ${e.gaia}` : `HSB ${e.hsb}`)]));
  const p = (nombre, fila) => (principalDe.get(fila) === nombre ? '' : principalDe.get(fila));
  trozosNombres.forEach((t, j) => escribir(`nombres-${j}.json`, { n: t.map(f => f[1]), i: t.map(f => f[2]), p: t.map(f => p(f[1], f[2])) }));
  escribir('propios.json', { n: otros.map(f => f[0]), i: otros.map(f => f[1]), p: otros.map(f => p(f[0], f[1])) });

  // --- TYC → índice, por TYC1 ---
  const tyc = [];
  for (const [indice, nombres] of nombresDe) for (const n of nombres) {
    const m = /^TYC (\d+)-(\d+)-(\d+)$/.exec(n);
    if (m) tyc.push([Number(m[1]), Number(m[2]), Number(m[3]), filaDe.get(indice)]);
  }
  tyc.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  const trozosTyc = trozos(tyc, POR_NUMEROS, f => f[0]);
  trozosTyc.forEach((t, j) => escribir(`tyc-${j}.json`, { t: t.map(f => `${f[0]}-${f[1]}-${f[2]}`), i: t.map(f => f[3]), p: t.map(f => p(`TYC ${f[0]}-${f[1]}-${f[2]}`, f[3])) }));

  // --- HSB → fila (el HSB como diferencia con el anterior del trozo) ---
  const hsb = orden.map((e, f) => [e.hsb, f]).sort((a, b) => a[0] - b[0]);
  const trozosHsb = trozos(hsb, POR_NUMEROS);
  trozosHsb.forEach((t, j) => escribir(`hsb-${j}.json`, { h: t.map((f, k) => (k ? f[0] - t[k - 1][0] : f[0])), i: t.map(f => f[1]) }));

  // --- Datos, en orden de Gaia DR3 ---
  let sinAstro = 0;
  const primeros = [];
  const MAX_DIF = BigInt(Number.MAX_SAFE_INTEGER);
  for (let j = 0; j * POR_DATOS < orden.length; j++) {
    const parte = orden.slice(j * POR_DATOS, (j + 1) * POR_DATOS);
    primeros.push(parte[0].gaia || '');
    // source_id: el primero entero (texto) y después la diferencia con el anterior (cabe en un número de JavaScript).
    const s = parte.map((e, k) => {
      if (!e.gaia) return null;
      if (!k || !parte[k - 1].gaia) return e.gaia;
      const dif = BigInt(e.gaia) - BigInt(parte[k - 1].gaia);
      if (dif <= 0n || dif > MAX_DIF) throw new Error(`Diferencia de source_id fuera de rango: ${e.gaia}`);
      return Number(dif);
    });
    const filas = parte.map(e => { const a = astro.get(e.gaia); if (!a) sinAstro++; return { e, a }; });
    escribir(`datos-${j}.json`, {
      s, k: filas.map(f => f.e.k), h: filas.map(f => f.e.hsb),
      g: filas.map(f => fijo(f.a?.g)), p: filas.map(f => fijo(f.a?.plx)), e: filas.map(f => fijo(f.a?.err)), c: filas.map(f => fijo(f.a?.bpRp)),
      n: filas.map(f => (nombresDe.get(f.e.k) || []).join('|')),
    });
  }

  // --- Manifiesto: primer valor de cada trozo y una huella del conjunto ---
  const huella = crypto.createHash('sha256');
  for (const [nombre, texto] of escritos) huella.update(`${nombre}\n${texto}\n`);
  const manifiesto = {
    n: capa.length, porDatos: POR_DATOS, nombres: trozosNombres.map(t => t[0][0]),
    tyc: trozosTyc.map(t => t[0][0]), gaia: primeros, hsb: trozosHsb.map(t => t[0][0]),
    huella: huella.digest('hex'),
  };
  fs.writeFileSync(`${CARPETA}/manifiesto.json`, JSON.stringify(manifiesto));
  escritos.push(['manifiesto.json', JSON.stringify(manifiesto)]);

  // Tamaños, con y sin gzip.
  const medir = filtro => escritos.filter(([n]) => filtro.test(n)).reduce((t, [, x]) => { const gz = zlib.gzipSync(x, { level: 9 }).length; return { n: t.n + 1, b: t.b + x.length, gz: t.gz + gz, max: Math.max(t.max, gz) }; }, { n: 0, b: 0, gz: 0, max: 0 });
  const mb = x => (x / 1e6).toFixed(2);
  for (const [nombre, re] of [['nombres', /^nombres-/], ['propios', /^propios/], ['tyc', /^tyc-/], ['hsb', /^hsb-/], ['datos', /^datos-/], ['manifiesto', /^manifiesto/]]) {
    const m = medir(re);
    console.log(`  ${nombre}: ${m.n} archivos, ${mb(m.b)} MB (gzip ${mb(m.gz)} MB; el mayor ${(m.max / 1000).toFixed(0)} KB con gzip)`);
  }
  const total = medir(/./);
  console.log(`✓ ${CARPETA}: ${total.n} archivos, ${mb(total.b)} MB (gzip ${mb(total.gz)} MB); ${catalogo.length} nombres de catálogo, ${otros.length} propios y de variable, ${tyc.length} TYC; sin astrometría: ${sinAstro}`);
}
