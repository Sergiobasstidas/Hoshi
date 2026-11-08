import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bvDesdeBpRp, escalasDeGrupo, gMenosV, leerGaia, magnitudG, tablaColores } from '../src/scene/gaiaCapa.js';

const archivo = fs.readFileSync('public/data/gaia-1m.bin');
const buffer = archivo.buffer.slice(archivo.byteOffset, archivo.byteOffset + archivo.byteLength);

test('gaia-1m.bin trae el millón de Gaia más las de GCNS, con posiciones y magnitudes válidas', () => {
  const { n, posiciones, magnitudes } = leerGaia(buffer);
  assert.ok(n > 1_200_000 && n < 1_400_000, `${n} estrellas`);
  let cerca = 0, lejos = 0;
  for (let k = 0; k < n; k++) {
    const d = Math.hypot(posiciones[3 * k], posiciones[3 * k + 1], posiciones[3 * k + 2]);
    assert.ok(Number.isFinite(d) && d > 1 && d < 20000);
    if (d < 10) cerca++;
    if (d > 1000) lejos++;
  }
  // Las estrellas cercanas ya están en el catálogo de Hoshi: aquí quedan muy pocas.
  assert.ok(cerca < 20, `${cerca} a menos de 10 pc`);
  assert.ok(lejos > 100_000);
  // 255 = magnitud absoluta de 19,875 o más débil (enanas marrones de GCNS).
  assert.ok(magnitudes.every(m => m > 0 && m <= 255));
});

test('un archivo con otro formato se rechaza', () => {
  assert.throws(() => leerGaia(new ArrayBuffer(64)), /formato inesperado/);
});

test('colores y magnitudes: G − V de Riello, B−V creciente y escalas finitas', () => {
  assert.equal(magnitudG(96), 0);
  assert.ok(Math.abs(gMenosV(0.82) - (-0.15)) < 0.03); // el Sol: G − V ≈ −0,15
  assert.ok(Math.abs(bvDesdeBpRp(0.82) - 0.65) < 0.05); // el Sol: B−V ≈ 0,65
  for (let c = -0.5; c < 3; c += 0.1) assert.ok(bvDesdeBpRp(c + 0.1) >= bvDesdeBpRp(c));
  const tabla = tablaColores();
  assert.equal(tabla.length, 1024);
  assert.ok(tabla.every(Number.isFinite));
  const { magnitudes, colores } = leerGaia(buffer);
  const gv = Float32Array.from({ length: 256 }, (_, k) => tabla[k * 4 + 3]);
  const { areaScale, energyScale } = escalasDeGrupo(magnitudes, colores, gv);
  assert.ok(areaScale > 0.5 && areaScale < 3 && energyScale > 0.1 && energyScale < 10);
});
