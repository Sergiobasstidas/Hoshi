import test from 'node:test';
import assert from 'node:assert/strict';
import { limbDarkening, surfaceActivity } from '../src/scene/stellarSurfaceModel.js';

test('la superficie animada es más activa en estrellas frías y casi lisa en las calientes', () => {
  const fria = surfaceActivity(3500), sol = surfaceActivity(5772), caliente = surfaceActivity(15000);
  assert.equal(fria.convection, 1);
  assert.equal(sol.convection, 1);
  assert.ok(caliente.convection < 0.15 && caliente.convection > 0);
  assert.ok(fria.spots > sol.spots && sol.spots > caliente.spots);
  for (let t = 2500; t < 40000; t += 250) {
    const a = surfaceActivity(t), b = surfaceActivity(t + 250);
    assert.ok(b.convection <= a.convection && b.spots <= a.spots);
    assert.ok(a.convection >= 0 && a.convection <= 1 && a.spots >= 0 && a.spots <= 1);
  }
});

test('el oscurecimiento del borde decrece con la temperatura y admite datos ausentes', () => {
  assert.ok(limbDarkening(3500) > limbDarkening(5772) && limbDarkening(5772) > limbDarkening(20000));
  assert.equal(limbDarkening(undefined), limbDarkening(5772));
  assert.deepEqual(surfaceActivity(NaN), surfaceActivity(5772));
});

test('la granulación reproduce la escala solar y crece en las gigantes', async () => {
  const { granulesPerRadius, approximateMassSolar, SOLAR_GRANULE_MM } = await import('../src/scene/stellarSurfaceModel.js');
  // Sol: 695,7 Mm de radio y gránulos de 1,3 Mm.
  assert.ok(Math.abs(granulesPerRadius(5772, 1) - 695.7 / SOLAR_GRANULE_MM) < 1e-9);
  assert.equal(approximateMassSolar(5772, 1), 1);
  // Una gigante fría tiene gránulos mucho mayores respecto a su radio (d ∝ T·R²/M).
  assert.ok(granulesPerRadius(4300, 25) < granulesPerRadius(5772, 1) / 5);
  assert.equal(approximateMassSolar(4300, 25), 1.5);
  assert.ok(granulesPerRadius(NaN, NaN) > 0 && granulesPerRadius(3000, 2000) >= 6);
});

test('las regiones activas son deterministas y respetan los rangos solares', async () => {
  const { activeRegions, MAX_ACTIVE_REGIONS, SUNSPOT, LOOP } = await import('../src/scene/stellarSurfaceModel.js');
  const sol = activeRegions(5772, 1);
  assert.deepEqual(sol, activeRegions(5772, 1));
  assert.ok(sol.length > 0 && sol.length <= MAX_ACTIVE_REGIONS);
  for (const region of sol) {
    const [x, y, z] = region.direction;
    assert.ok(Math.abs(Math.hypot(x, y, z) - 1) < 1e-12);
    const latitude = Math.abs(Math.asin(y)) * 180 / Math.PI;
    assert.ok(latitude >= 5 - 1e-9 && latitude <= SUNSPOT.maxLatitudeDeg + 1e-9);
    assert.ok(region.umbraRadius * 695.7 >= SUNSPOT.umbraRadiusMm[0] - 1e-9 && region.umbraRadius * 695.7 <= SUNSPOT.umbraRadiusMm[1] + 1e-9);
    for (const loop of region.loops) {
      assert.ok(loop.separation * 695.7 >= LOOP.separationMm[0] - 1e-9 && loop.separation * 695.7 <= LOOP.separationMm[1] + 1e-9);
      assert.ok(loop.height * 695.7 <= LOOP.maxHeightMm + 1e-9);
    }
  }
  // Una estrella caliente sin envoltura convectiva no tiene regiones activas.
  assert.equal(activeRegions(9900, 1.7).length, 0);
});
