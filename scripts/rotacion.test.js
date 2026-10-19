import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLANET_TEXTURES, bodyAxes } from '../src/scene/planetTextures.js';
import { moonOffset, planetPosition } from '../src/scene/solarEphemeris.js';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const DEG = 180 / Math.PI;

test('rotación: la Tierra tiene el Sol en el cenit donde corresponde a esa hora', () => {
  // 19/10/2026 15:00 UTC: mediodía solar en ≈ 48,7° O (ecuación del tiempo ≈ +15 min) y
  // declinación del Sol ≈ −10°.
  const date = new Date(Date.UTC(2026, 9, 19, 15));
  const axes = bodyAxes(PLANET_TEXTURES.Tierra, date);
  const earth = planetPosition('Tierra', date), length = Math.hypot(...earth);
  const sun = earth.map(value => -value / length);
  const longitude = Math.atan2(-dot(sun, axes.z), dot(sun, axes.x)) * DEG, latitude = Math.asin(dot(sun, axes.y)) * DEG;
  assert.ok(Math.abs(longitude + 48.7) < 1, `longitud ${longitude}`);
  assert.ok(Math.abs(latitude + 10) < 1, `latitud ${latitude}`);
});

test('rotación: la Luna muestra a la Tierra su cara visible y los ejes son ortonormales', () => {
  for (const day of [0, 7, 14, 21]) {
    const date = new Date(Date.UTC(2026, 9, 19 + day));
    const axes = bodyAxes(PLANET_TEXTURES.Luna, date);
    const offset = moonOffset(date), length = Math.hypot(...offset);
    // Las libraciones apartan la cara visible hasta unos 8°.
    assert.ok(Math.acos(-dot(axes.x, offset) / length) * DEG < 9);
  }
  for (const texture of Object.values(PLANET_TEXTURES)) {
    const { x, y, z } = bodyAxes(texture, new Date());
    assert.ok(Math.abs(dot(x, y)) < 1e-12 && Math.abs(dot(x, z)) < 1e-12 && Math.abs(Math.hypot(...z) - 1) < 1e-12);
  }
});
