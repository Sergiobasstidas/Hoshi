import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { parse } from 'csv-parse/sync';
import { SALIDA, clave, estrellasCapa } from './catalog/capa_nombres.js';

const texto = zlib.gunzipSync(fs.readFileSync(SALIDA)).toString('utf8');
const datos = parse(texto, { columns: true }).map(f => ({ hsb: Number(f.hsb), gaia: f.gaia_dr3, nombres: f.nombres.split('|') }));

test('hsb_capa_nombres: cada fila es una estrella de la capa con su Gaia DR3', () => {
  assert.ok(texto.startsWith('hsb,gaia_dr3,nombres\n'));
  const capa = new Map(estrellasCapa().map(e => [e.hsb, e.gaia]));
  for (const { hsb, gaia } of datos) {
    assert.ok(capa.has(hsb), `HSB ${hsb} no está en la capa`);
    assert.equal(capa.get(hsb), gaia, `HSB ${hsb}`);
  }
  assert.equal(new Set(datos.map(d => d.hsb)).size, datos.length, 'HSB repetido');
  const orden = datos.map(d => d.hsb);
  assert.deepEqual(orden, [...orden].sort((a, b) => a - b));
});

test('hsb_capa_nombres: ningún nombre se repite ni es de una estrella del catálogo principal', () => {
  const vistos = new Map();
  for (const { hsb, nombres } of datos) {
    assert.ok(nombres.length > 0 && nombres.every(Boolean), `HSB ${hsb} sin nombres`);
    for (const n of nombres) {
      assert.ok(!/^TIC\b/.test(n), `TIC en la capa: ${n}`);
      const k = clave(n);
      assert.ok(!vistos.has(k), `«${n}» en HSB ${vistos.get(k)} y ${hsb}`);
      vistos.set(k, hsb);
    }
  }
  for (const f of ['star-search.json', 'star-search-variables.json', 'star-search-numeros.json']) {
    for (const [i, alias] of JSON.parse(fs.readFileSync(`public/data/${f}`, 'utf8'))) {
      for (const a of alias) assert.ok(!vistos.has(clave(a)), `«${a}» es de la estrella ${i} del catálogo y de HSB ${vistos.get(clave(a))} en la capa`);
    }
  }
});
