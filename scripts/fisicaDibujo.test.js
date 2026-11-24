import test from 'node:test';
import assert from 'node:assert/strict';
import { claseDibujo, claseSuperficie, fisicaDibujo, radioTipico } from '../src/scene/fisicaDibujo.js';
import { aspectoPorClase, granulesPerRadius, granulosPorClase } from '../src/scene/stellarSurfaceModel.js';

test('con radio medido o de catálogo se usa ese, sin tocarlo', () => {
  const physics = { radiusSolar: 122, temperatureK: 4389, radiusPc: 1 };
  assert.equal(fisicaDibujo({ physics, sp: 'K3II-III' }), physics);
});

test('sin radio, uno típico de su tipo y clase, marcado como dibujo', () => {
  const lrVel = fisicaDibujo({ sp: 'B6Ia', m: -5.518, c: 0.689, d: 1860 });
  assert.equal(lrVel.clase, 'supergigante');
  assert.ok(lrVel.dibujo && lrVel.radiusSolar > 30 && lrVel.radiusSolar < 80, `${lrVel.radiusSolar}`);
  assert.ok(lrVel.temperatureK > 12000 && lrVel.temperatureK < 16000, `${lrVel.temperatureK}`);
  const wolf = fisicaDibujo({ sp: 'dM6', m: 16.5, d: 2.4 });
  assert.equal(wolf.clase, 'enana');
  assert.ok(wolf.radiusSolar < 0.25 && wolf.temperatureK < 3200);
  const etaSer = fisicaDibujo({ sp: 'K0III-IV', m: 1.889, d: 18.5 });
  assert.equal(etaSer.clase, 'gigante');
  assert.ok(etaSer.radiusSolar > 8 && etaSer.radiusSolar < 20);
  assert.equal(fisicaDibujo({ sp: 'DA2.9', m: 11, d: 5 }).clase, 'enanaBlanca');
});

test('un radio oficial sin temperatura se respeta', () => {
  const f = fisicaDibujo({ sp: 'G2V', m: 4.8, d: 10, datos: { radiusSolar: 1.3 } });
  assert.equal(f.radiusSolar, 1.3);
  assert.equal(f.dibujo, false);
});

test('sin clase o con una que contradice el brillo: gigante si es más brillante que una enana de su letra', () => {
  assert.equal(claseDibujo('K0', 0.5, 5000, 50), 'gigante');
  assert.equal(claseDibujo('K0', 6, 5000, 50), 'enana');
  assert.equal(claseDibujo('K0V', 0.5, 5000, 50), 'gigante');
  assert.equal(claseDibujo('K0III', 6, 5000, 50), 'enana');
  assert.equal(claseDibujo(null, 8, 3500, 10), 'enana');
  assert.equal(claseDibujo('M1-M2Ia-Iab', -6.3, 3600, 222), 'supergigante');
  assert.equal(claseDibujo('G2_0', -8, 5000, 3000), 'hipergigante');
});

test('sin tipo: temperatura por el color y clase por el brillo', () => {
  const f = fisicaDibujo({ m: 5, c: 0.65, d: 20 });
  assert.ok(f.temperatureK > 5500 && f.temperatureK < 6100);
  assert.equal(f.clase, 'enana');
  const capa = fisicaDibujo({ m: 0, capa: { bpRp: 1.4 }, d: 400 });
  assert.equal(capa.clase, 'gigante');
});

test('radios típicos crecen de enana a supergigante', () => {
  for (const t of [3600, 4500, 5800]) assert.ok(radioTipico('enana', t) < radioTipico('gigante', t) && radioTipico('gigante', t) < radioTipico('supergigante', t));
});

test('celdas por clase: enanas como el Sol, gigantes con miles, supergigantes con pocas', () => {
  assert.equal(granulosPorClase(5772, 1, 'enana'), granulesPerRadius(5772, 1));
  const hassaleh = granulosPorClase(4389, 122, 'gigante');
  assert.ok(hassaleh >= 20 && 2 * Math.PI * hassaleh ** 2 > 2000, `${hassaleh}`);
  assert.ok(granulosPorClase(3600, 727, 'supergigante') <= 6);
  assert.deepEqual(Object.keys(aspectoPorClase('gigante')).sort(), ['fino', 'suave', 'variacion']);
  assert.equal(claseSuperficie({ physics: { temperatureK: 4389 }, sp: 'K3II-III', m: -3.2, d: 151 }), 'gigante');
});
