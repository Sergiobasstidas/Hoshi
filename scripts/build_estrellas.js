// scripts/build_estrellas.js
// Archivo único de estrellas de la app: public/data/estrellas.bin.gz (formato en src/scene/estrellasBin.js; se guarda con
// gzip nivel 9, que da siempre los mismos bytes, y la app lo descomprime al bajarlo).
//  - Catálogo (data/processed/stars_15pc.json): número HSB, posición y distancia exactas (cada valor se guarda como
//    entero y cantidad de decimales, y la división da el mismo número que hoy lee la app; si no, va en float64),
//    magnitud absoluta y B−V con 3 decimales, color RGB, tipo espectral (tabla) y nombre.
//  - Capa de fondo (data/processed/gaia-1m.bin: millón de Gaia DR3 y GCNS): posición cuantizada en 3 × uint16
//    dentro de celdas de hasta 4.096 estrellas, y los mismos bytes de magnitud y color que hoy. No entran las
//    fuentes que build_hsb enlazó con una estrella del catálogo (data/catalog/hsb_capa_enlazadas.csv): ya se
//    dibujan como esa estrella.
// Aparte, public/data/estrellas-hsb.bin: número HSB de cada estrella de la capa de fondo, en el mismo orden (la app
// no lo baja al abrir). Uso: node scripts/build_estrellas.js (después de process_gaia.js y build_hsb.js).

import fs from 'node:fs';
import zlib from 'node:zlib';
import { parse } from 'csv-parse/sync';
import { leerGaia } from '../src/scene/gaiaCapa.js';
import { ESTRELLAS_FIRMA, ESTRELLAS_VERSION, MAX_POR_CELDA, codificarValor } from '../src/scene/estrellasBin.js';
import { leerEnlaces } from './catalog/enlaces_registro.js';

const STARS = './data/processed/stars_15pc.json', CAPA = './data/processed/gaia-1m.bin';
const ORDEN = './data/catalog/gaia_capa_orden.txt.gz', REGISTRO = './data/catalog/hsb_registro.csv', LOTES = './data/catalog/hsb_gaia';
const ENLAZADAS = './data/catalog/hsb_capa_enlazadas.csv';
const SALIDA = './public/data/estrellas.bin.gz', SALIDA_HSB = './public/data/estrellas-hsb.bin';

// Octree sobre las posiciones: celdas cúbicas de hasta MAX_POR_CELDA estrellas y de lado ≤ MAX_LADO_PC; además, cerca
// del Sol, de lado ≤ la mitad de su distancia (mínimo 2 pc), para que el error sea también chico visto desde aquí.
export const MAX_LADO_PC = 256;
export function celdas(pos, n, max = MAX_POR_CELDA, maxLado = MAX_LADO_PC) {
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let k = 0; k < n; k++) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], pos[3 * k + a]); mx[a] = Math.max(mx[a], pos[3 * k + a]); }
  const lado = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) * 1.000001 + 1e-9;
  const salida = [];
  const pila = [{ o: mn, lado, ids: Uint32Array.from({ length: n }, (_, k) => k) }];
  while (pila.length) {
    const c = pila.pop();
    const centro = Math.hypot(c.o[0] + c.lado / 2, c.o[1] + c.lado / 2, c.o[2] + c.lado / 2);
    const limite = Math.min(maxLado, Math.max(2, (centro - c.lado) / 2));
    if ((c.ids.length <= max && c.lado <= limite) || c.lado < 1e-6) { if (c.ids.length) salida.push(c); continue; }
    const h = c.lado / 2, hijos = Array.from({ length: 8 }, () => []);
    for (const k of c.ids) {
      const b = (pos[3 * k] >= c.o[0] + h ? 1 : 0) | (pos[3 * k + 1] >= c.o[1] + h ? 2 : 0) | (pos[3 * k + 2] >= c.o[2] + h ? 4 : 0);
      hijos[b].push(k);
    }
    for (let b = 7; b >= 0; b--) if (hijos[b].length) pila.push({ o: [c.o[0] + (b & 1 ? h : 0), c.o[1] + (b & 2 ? h : 0), c.o[2] + (b & 4 ? h : 0)], lado: h, ids: Uint32Array.from(hijos[b]) });
  }
  return salida;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const stars = JSON.parse(fs.readFileSync(STARS, 'utf8'));
  const n = stars.length;
  // --- Catálogo ---
  const tablaSp = [...new Set(stars.map(s => s.sp || ''))].sort();
  const indiceSp = new Map(tablaSp.map((sp, k) => [sp, k]));
  const nombres = {};
  for (const s of stars) if (s.n) nombres[s.i] = s.n;
  const hsb = new Uint32Array(n), mant = new Int32Array(n * 4), dec = new Int8Array(n * 4), m = new Int16Array(n), c = new Int16Array(n);
  const rgb = new Uint8Array(n * 3), sp = new Uint16Array(n), extra = [];
  stars.forEach((s, k) => {
    hsb[k] = s.i;
    ['x', 'y', 'z', 'd'].forEach((campo, a) => {
      const cod = codificarValor(s[campo]);
      if (cod) { mant[4 * k + a] = cod[0]; dec[4 * k + a] = cod[1]; } else { dec[4 * k + a] = -128; extra.push(s[campo]); }
    });
    for (const [arr, v] of [[m, s.m], [c, s.c]]) {
      const e = Math.round(v * 1000);
      if (e / 1000 !== v || Math.abs(e) > 32767) throw new Error(`Valor fuera de formato en ${s.i}: ${v}`);
      arr[k] = e;
    }
    rgb.set(s.rgb, 3 * k);
    sp[k] = indiceSp.get(s.sp || '');
  });
  // --- Capa de fondo ---
  const capa = fs.readFileSync(CAPA);
  const todas = leerGaia(capa.buffer.slice(capa.byteOffset, capa.byteOffset + capa.byteLength));
  // Número HSB de cada fuente: el del registro o un lote, o el de la estrella del registro con la que se
  // enlazó; si esa estrella está en el catálogo, la fuente no entra (sería la misma estrella dos veces).
  const fuentes = zlib.gunzipSync(fs.readFileSync(ORDEN)).toString('utf8').trim().split('\n');
  if (fuentes.length !== todas.n) throw new Error(`gaia_capa_orden: ${fuentes.length} filas para ${todas.n} estrellas`);
  const deGaia = new Map();
  for (const r of parse(fs.readFileSync(REGISTRO, 'utf8'), { columns: true })) if (r.gaia_dr3 && r.estado === 'activa') deGaia.set(r.gaia_dr3, Number(r.hsb));
  for (const nombre of fs.readdirSync(LOTES).filter(f => f.endsWith('.csv.gz')).sort()) {
    // El registro manda: un Gaia que una corrección de enlace le dio a una estrella del registro conserva ese número.
    for (const r of parse(zlib.gunzipSync(fs.readFileSync(`${LOTES}/${nombre}`)).toString('utf8'), { columns: true })) if (!deGaia.has(r.gaia_dr3)) deGaia.set(r.gaia_dr3, Number(r.hsb));
  }
  const enlazada = new Map(parse(fs.readFileSync(ENLAZADAS, 'utf8'), { columns: true }).map(r => [r.gaia_dr3, Number(r.hsb)]));
  const enCatalogo = new Set(hsb);
  // Números de lote que la auditoría dio por iguales a otra estrella (data/catalog/hsb_enlaces.csv, igual_a).
  const igualA = new Map(leerEnlaces().filter(f => f.campo === 'igual_a').map(f => [Number(f.hsb), Number(f.valor)]));
  const quedan = [], hsbFuente = [];
  let quitadas = 0, sinNumero = 0;
  for (let k = 0; k < todas.n; k++) {
    // Fuera: las enlazadas con una estrella del catálogo y las que son el Gaia DR3 de una (ya se dibujan desde el catálogo).
    const h = enlazada.get(fuentes[k]) ?? (enCatalogo.has(deGaia.get(fuentes[k])) ? deGaia.get(fuentes[k]) : igualA.get(deGaia.get(fuentes[k])));
    if (h !== undefined && enCatalogo.has(h)) { quitadas++; continue; }
    const numero = deGaia.get(fuentes[k]) ?? h;
    if (numero === undefined) sinNumero++;
    quedan.push(k); hsbFuente.push(numero ?? 0);
  }
  const g = quedan.length;
  const posiciones = new Float32Array(3 * g), magnitudes = new Uint8Array(g), colores = new Uint8Array(g);
  quedan.forEach((k, j) => {
    posiciones.set(todas.posiciones.subarray(3 * k, 3 * k + 3), 3 * j);
    magnitudes[j] = todas.magnitudes[k]; colores[j] = todas.colores[k];
  });
  const lista = celdas(posiciones, g);
  const q = new Uint16Array(g * 3), mg = new Uint8Array(g), cg = new Uint8Array(g), orden = new Uint32Array(g);
  const tablaCeldas = [];
  let j = 0, errMax = 0;
  // Error máximo de posición por tramo de distancia al Sol (pc): < 10, 10–100, 100–1.000, > 1.000.
  const tramos = [10, 100, 1000, Infinity], errTramo = [0, 0, 0, 0];
  for (const celda of lista) {
    tablaCeldas.push([...celda.o, celda.lado, j, celda.ids.length]);
    const paso = celda.lado / 65535;
    for (const k of celda.ids) {
      for (let a = 0; a < 3; a++) {
        const v = Math.round((posiciones[3 * k + a] - celda.o[a]) / paso);
        q[3 * j + a] = Math.max(0, Math.min(65535, v));
        errMax = Math.max(errMax, Math.abs(celda.o[a] + q[3 * j + a] * paso - posiciones[3 * k + a]));
      }
      const err = Math.hypot(...[0, 1, 2].map(a => celda.o[a] + q[3 * j + a] * paso - posiciones[3 * k + a]));
      const t = tramos.findIndex(lim => Math.hypot(posiciones[3 * k], posiciones[3 * k + 1], posiciones[3 * k + 2]) < lim);
      errTramo[t] = Math.max(errTramo[t], err);
      mg[j] = magnitudes[k]; cg[j] = colores[k]; orden[j] = k; j++;
    }
  }
  // --- Cabecera y archivo ---
  const cabecera = { nCatalogo: n, nCapa: g, nExtra: extra.length, sp: tablaSp, nombres };
  const json = Buffer.from(JSON.stringify(cabecera));
  const relleno = (8 - ((12 + json.length) % 8)) % 8;
  const partes = [Buffer.from(ESTRELLAS_FIRMA, 'ascii'), Buffer.from(new Uint32Array([ESTRELLAS_VERSION, json.length + relleno]).buffer), json, Buffer.alloc(relleno, 32),
    Buffer.from(Float64Array.from(extra).buffer), Buffer.from(hsb.buffer), Buffer.from(mant.buffer), Buffer.from(m.buffer), Buffer.from(c.buffer), Buffer.from(sp.buffer),
    Buffer.from(dec.buffer), Buffer.from(rgb.buffer)];
  // Celdas de la capa después del catálogo: relleno hasta múltiplo de 4, largo y JSON con espacios hasta un largo par
  // (así la capa empieza en un byte par).
  const finCatalogo = partes.reduce((t, b) => t + b.length, 0);
  const jsonCeldas = Buffer.from(JSON.stringify(tablaCeldas));
  const largoCeldas = jsonCeldas.length + (jsonCeldas.length % 2);
  partes.push(Buffer.alloc((4 - (finCatalogo % 4)) % 4), Buffer.from(new Uint32Array([largoCeldas]).buffer), jsonCeldas, Buffer.alloc(largoCeldas - jsonCeldas.length, 32),
    Buffer.from(q.buffer), Buffer.from(mg.buffer), Buffer.from(cg.buffer));
  const archivo = Buffer.concat(partes);
  const comprimido = zlib.gzipSync(archivo, { level: 9 });
  fs.writeFileSync(SALIDA, comprimido);
  // --- Número HSB de la capa de fondo, en el orden del archivo ---
  const hsbCapa = Uint32Array.from(orden, k => hsbFuente[k]);
  fs.writeFileSync(SALIDA_HSB, Buffer.from(hsbCapa.buffer));
  const critico = zlib.gzipSync(archivo.subarray(0, finCatalogo), { level: 9 }).length;
  console.log(`✓ ${SALIDA}: ${(comprimido.length / 1048576).toFixed(2)} MB (sin comprimir ${(archivo.length / 1048576).toFixed(2)} MB; hasta el fin del catálogo ${(finCatalogo / 1048576).toFixed(2)} MB, ${(critico / 1048576).toFixed(2)} MB con gzip); catálogo ${n} (${extra.length} valores en float64), capa ${g} en ${lista.length} celdas; error máx. de posición ${(errMax * 206264.8).toFixed(1)} UA`);
  console.log(`✓ ${SALIDA_HSB}: ${g} números HSB; sin número: ${sinNumero}; fuentes que ya son una estrella del catálogo (no entran): ${quitadas}`);
  console.log(`  Error máximo de posición de la capa (UA): < 10 pc ${(errTramo[0] * 206264.8).toFixed(3)}, 10–100 pc ${(errTramo[1] * 206264.8).toFixed(2)}, 100–1.000 pc ${(errTramo[2] * 206264.8).toFixed(1)}, > 1.000 pc ${(errTramo[3] * 206264.8).toFixed(1)}`);
}
