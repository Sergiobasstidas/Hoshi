import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EPHEMERIS_DATE } from '../src/scene/solarEphemeris.js';
import { moonOffsetPc } from '../src/scene/moonEphemeris.js';
import { moonAxes, moonTextureUrl } from '../src/scene/moonTextures.js';

const { moons } = JSON.parse(readFileSync(new URL('../public/data/moons.json', import.meta.url)));
const DEG = 180 / Math.PI;

test('cada luna sincrónica con mapa mira a su planeta con la longitud 0, en cualquier fecha', () => {
  const conMapa = moons.filter(moon => moonTextureUrl(moon.code));
  assert.equal(conMapa.length, 10);
  // Cada 37 días entre 2000 y 2040, además de la fecha de carga: la orientación no depende del día.
  const fechas = [EPHEMERIS_DATE];
  for (let t = Date.UTC(2000, 0, 1); t <= Date.UTC(2040, 0, 1); t += 37 * 86400000) fechas.push(new Date(t));
  for (const moon of conMapa) for (const fecha of fechas) {
    const haciaPlaneta = moonOffsetPc(moon, fecha).map(value => -value), length = Math.hypot(...haciaPlaneta);
    const { x } = moonAxes(moon.code, fecha, haciaPlaneta);
    const angulo = Math.acos((x[0] * haciaPlaneta[0] + x[1] * haciaPlaneta[1] + x[2] * haciaPlaneta[2]) / length) * DEG;
    assert.ok(angulo < 1, `${moon.name} el ${fecha.toISOString().slice(0, 10)}: ${angulo.toFixed(1)}°`);
  }
});
