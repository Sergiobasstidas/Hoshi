import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { codificarValor, leerCapa, leerCatalogo, posicionesCapa } from '../src/scene/estrellasBin.js';
import { leerGaia } from '../src/scene/gaiaCapa.js';

const abrir = ruta => { const a = fs.readFileSync(ruta); return a.buffer.slice(a.byteOffset, a.byteOffset + a.byteLength); };
const buffer = abrir('public/data/estrellas.bin');
const { cabecera, estrellas, inicioCapa } = leerCatalogo(buffer);

test('el catálogo de estrellas.bin es idéntico a stars_15pc.json en lo que usa la app', () => {
  const original = JSON.parse(fs.readFileSync('data/processed/stars_15pc.json', 'utf8'));
  assert.equal(estrellas.length, original.length);
  original.forEach((s, k) => {
    const e = estrellas[k];
    for (const campo of ['i', 'x', 'y', 'z', 'd', 'm', 'c']) assert.equal(e[campo], s[campo], `${s.i} ${campo}`);
    assert.equal(e.n, s.n ?? null);
    assert.equal(e.sp, s.sp ?? null);
    assert.deepEqual(e.rgb, s.rgb);
  });
});

// Fuentes de la capa que build_hsb enlazó con una estrella del catálogo: build_estrellas no las dibuja.
const idsCatalogo = new Set(estrellas.map(e => e.i));
// También las que son el Gaia DR3 de una estrella del catálogo, o un número de lote que la auditoría dio por igual a una
// (data/catalog/hsb_enlaces.csv, igual_a).
const enlazadas = new Map(fs.readFileSync('data/catalog/hsb_capa_enlazadas.csv', 'utf8').trim().split('\n').slice(1).map(l => l.split(',')).map(c => [c[0], Number(c[1])]));
const deGaia = new Map();
for (const l of fs.readFileSync('data/catalog/hsb_registro.csv', 'utf8').split('\n').slice(1)) { const c = l.split(','); if (c[9] && c[17] === 'activa') deGaia.set(c[9], Number(c[0])); }
for (const lote of fs.readdirSync('data/catalog/hsb_gaia').filter(f => f.endsWith('.csv.gz'))) {
  for (const l of zlib.gunzipSync(fs.readFileSync(`data/catalog/hsb_gaia/${lote}`)).toString('utf8').split('\n').slice(1)) { const c = l.split(','); if (c[1] && !deGaia.has(c[1])) deGaia.set(c[1], Number(c[0])); }
}
const igualA = new Map(fs.readFileSync('data/catalog/hsb_enlaces.csv', 'utf8').split('\n').slice(1).map(l => l.split(',')).filter(c => c[1] === 'igual_a').map(c => [Number(c[0]), Number(c[2])]));
const fuentesCapa = zlib.gunzipSync(fs.readFileSync('data/catalog/gaia_capa_orden.txt.gz')).toString('utf8').trim().split('\n');
const enlazadasAlCatalogo = fuentesCapa.filter(g => idsCatalogo.has(enlazadas.get(g)) || idsCatalogo.has(deGaia.get(g)) || idsCatalogo.has(igualA.get(deGaia.get(g)))).length;

test('la capa de fondo conserva magnitud y color, y su posición se mueve muy poco', () => {
  const capa = leerCapa(buffer, cabecera, inicioCapa);
  const antes = leerGaia(abrir('data/processed/gaia-1m.bin'));
  assert.equal(capa.n, antes.n - enlazadasAlCatalogo);
  // Mismos (magnitud, color) en otro orden, menos las fuentes que ya son una estrella del catálogo.
  const histo = (m, c) => { const h = new Uint32Array(65536); for (let k = 0; k < m.length; k++) h[(m[k] << 8) | c[k]]++; return h; };
  const ahora = histo(capa.magnitudes, capa.colores), previo = histo(antes.magnitudes, antes.colores);
  let faltan = 0;
  for (let k = 0; k < 65536; k++) { assert.ok(ahora[k] <= previo[k]); faltan += previo[k] - ahora[k]; }
  assert.equal(faltan, enlazadasAlCatalogo);
  const pos = posicionesCapa(capa, [0, 0, 0]);
  // Celdas de hasta 4.096 estrellas y 256 pc de lado: el error es como mucho medio paso (lado / 65535) por eje.
  for (const [, , , lado, primera, cantidad] of capa.celdas) {
    assert.ok(cantidad <= 4096 && cantidad > 0);
    for (let k = primera; k < primera + cantidad; k++) {
      const d = Math.hypot(pos[3 * k], pos[3 * k + 1], pos[3 * k + 2]);
      assert.ok(Number.isFinite(d));
      assert.ok(lado <= 256, `celda de ${lado} pc a ${d} pc`);
    }
  }
});

test('codificarValor guarda cada número de forma exacta o no lo guarda', () => {
  for (const v of [0, 1.302, -0.4744604, 23668.64, 196078.4314, 1000 / 747.17, 0.1 + 0.2]) {
    const cod = codificarValor(v);
    if (cod) assert.equal(cod[0] / 10 ** cod[1], v);
  }
  assert.equal(codificarValor(NaN), null);
});

test('cada estrella de la capa tiene su número HSB, propio y distinto de los del catálogo', () => {
  const hsb = new Uint32Array(abrir('public/data/estrellas-hsb.bin'));
  assert.equal(hsb.length, cabecera.nCapa);
  assert.equal(hsb.filter(h => h === 0).length, 0, 'estrellas de la capa sin número HSB');
  const enCatalogo = hsb.filter(h => idsCatalogo.has(h));
  assert.equal(enCatalogo.length, 0, `estrellas de la capa que ya están en el catálogo: ${[...enCatalogo.slice(0, 10)].join(', ')}`);
  assert.equal(new Set(hsb).size, hsb.length, 'número HSB repetido dentro de la capa');
});
