import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { parse } from 'csv-parse/sync';
import { COLUMNAS } from './catalog/build_hsb.js';
import { leerEnlaces } from './catalog/enlaces_registro.js';

const stars = new Map(JSON.parse(fs.readFileSync('data/processed/stars_15pc.json', 'utf8')).map(s => [s.i, s]));
const registro = new Map(parse(fs.readFileSync('data/catalog/hsb_registro.csv', 'utf8'), { columns: true }).map(r => [Number(r.hsb), r]));
const fuentes = new Map(parse(zlib.gunzipSync(fs.readFileSync('data/catalog/hsb_fuentes.csv.gz')).toString('utf8'), { columns: true }).map(f => [Number(f.hsb), f]));
const sistemas = JSON.parse(fs.readFileSync('data/processed/star_systems.json', 'utf8'));
const sep = (a, b) => Math.acos(Math.min(1, (a.x * b.x + a.y * b.y + a.z * b.z) / (Math.hypot(a.x, a.y, a.z) * Math.hypot(b.x, b.y, b.z)))) * 206264.806;

test('correcciones de enlace: el registro solo crece y la estrella repetida apunta a la que se conserva', () => {
  assert.ok(COLUMNAS.includes('igual_a'));
  const enlaces = leerEnlaces();
  assert.ok(enlaces.length > 900 && enlaces.every(f => f.hsb && f.campo && f.motivo));
  const gl277 = registro.get(727499);
  assert.equal(gl277.estado, 'retirada');
  assert.equal(gl277.igual_a, '727498');
  assert.ok(!stars.has(727499) && stars.has(727498));
  // Toda retirada por repetida apunta a una estrella activa del registro.
  for (const r of registro.values()) if (r.igual_a) assert.equal(registro.get(Number(r.igual_a))?.estado, 'activa', `HSB ${r.hsb}`);
});

test('Toliman y Nihal: sin el Gaia de otro objeto; color de Hipparcos o del Gaia correcto', () => {
  const toliman = stars.get(1451151), nihal = stars.get(412544);
  assert.equal(registro.get(1451151).gaia_dr3, '');
  assert.equal(toliman.c, 0.9);
  assert.equal(registro.get(412544).gaia_dr3, '2968097043228517120');
  assert.ok(Math.abs(nihal.c - 0.807) < 0.05, `Nihal B−V ${nihal.c}`);
});

test('Alula Australis A y B: cada una en su posición de Gaia, a su separación', () => {
  const a = stars.get(1175645), b = stars.get(1175646);
  assert.equal(fuentes.get(1175645).fuente_pos, 'Gaia DR3 (J2000)');
  assert.equal(fuentes.get(1175646).fuente_pos, 'Gaia DR3 (J2000)');
  assert.ok(sep(a, b) > 1.5 && sep(a, b) < 3, `${sep(a, b)}″`);
  assert.notEqual(b.c, 0);
});

test('Taygeta y Merope con Hipparcos 2007; Proxima en su posición de Gaia; valor anterior guardado', () => {
  for (const [i, d] of [[274126, 125.47], [275407, 116.55]]) {
    assert.ok(Math.abs(stars.get(i).d - d) < 0.05, `${i}: ${stars.get(i).d}`);
    assert.match(fuentes.get(i).fuente_d, /^Hipparcos/);
    // Valor reemplazado y su fuente (el de AT-HYG antes de aplicar la escalera).
    assert.ok(Number(fuentes.get(i).d_antes) > 0 && fuentes.get(i).fuente_d_antes);
  }
  assert.equal(fuentes.get(1436975).fuente_pos, 'Gaia DR3 (J2000)');
  assert.match(fuentes.get(1436975).pos_antes, /AT-HYG; 17\.\d+″/);
});

test('separaciones: el par de θ¹ Orionis (HIP 26221) sigue a la distancia común aunque la primaria cambió en otro sistema', () => {
  const clave = 425553, d = stars.get(clave).d;
  const ab = sistemas[clave].comps.find(c => c.pair === 'STF 748' && c.n === 'B');
  assert.ok(Math.abs(ab.rho / d - 8.8) / 8.8 < 0.01, `${ab.rho} UA a ${d} pc`);
});

test('decisión D: la conversión BP−RP → B−V sube sin saltos hasta las enanas M8.5V', async () => {
  const { bvDesdeBpRp } = await import('../src/scene/gaiaCapa.js');
  let anterior = -Infinity;
  for (let x = -0.4; x <= 5.4; x += 0.01) { const v = bvDesdeBpRp(x); assert.ok(v >= anterior - 1e-9, `baja en ${x}`); assert.ok(v - anterior < 0.05 || anterior === -Infinity, `salto en ${x}`); anterior = v; }
  assert.equal(bvDesdeBpRp(5.1), 2.16);
  assert.ok(bvDesdeBpRp(4) > 1.9);
});

test('decisión C: el color por tipo es solo para dibujar y queda marcado', () => {
  const marcadas = [...fuentes.values()].filter(f => f.fuente_c === 'color por tipo (dibujo)');
  assert.ok(marcadas.length > 40);
  for (const f of marcadas) assert.ok(stars.get(Number(f.hsb))?.sp, `HSB ${f.hsb} sin tipo`);
});

test('decisión B: distancias medidas publicadas para Antares, Alniyat, Fang y Mekbuda', () => {
  for (const [i, d, fuente] of [[1620181, 146, /Upper Scorpius/], [1605930, 146, /Upper Scorpius/], [1569628, 146, /Upper Scorpius/], [641742, 359.7122, /Benedict/]]) {
    assert.equal(stars.get(i).d, d);
    assert.match(fuentes.get(i).fuente_d, fuente);
  }
});
