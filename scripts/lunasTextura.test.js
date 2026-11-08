import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EPHEMERIS_DATE } from '../src/scene/solarEphemeris.js';
import { moonOffsetPc } from '../src/scene/moonEphemeris.js';
import { moonAxes, moonTextureUrl } from '../src/scene/moonTextures.js';

const { moons } = JSON.parse(readFileSync(new URL('../public/data/moons.json', import.meta.url)));
const DEG = 180 / Math.PI;

test('cada luna sincrónica con mapa mira a su planeta con la longitud 0 en la fecha de carga', () => {
  const conMapa = moons.filter(moon => moonTextureUrl(moon.code));
  assert.equal(conMapa.length, 10);
  for (const moon of conMapa) {
    const offset = moonOffsetPc(moon, EPHEMERIS_DATE), length = Math.hypot(...offset);
    const { x } = moonAxes(moon.code, EPHEMERIS_DATE);
    const angulo = Math.acos(-(x[0] * offset[0] + x[1] * offset[1] + x[2] * offset[2]) / length) * DEG;
    assert.ok(angulo < 8, `${moon.name}: ${angulo.toFixed(1)}°`);
  }
});
