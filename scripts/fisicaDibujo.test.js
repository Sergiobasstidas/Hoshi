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

test('celdas fuera del Sol: nunca menos por radio que en el Sol, sea cual sea el tamaño', () => {
  const sol = granulesPerRadius(5772, 1);
  assert.equal(granulosPorClase(5772, 1), sol);
  assert.equal(granulosPorClase(4389, 122), sol);
  assert.equal(granulosPorClase(3600, 727), sol);
  assert.ok(granulosPorClase(3200, 0.3) > sol);
  assert.deepEqual(Object.keys(aspectoPorClase('gigante')).sort(), ['fino', 'suave', 'variacion']);
  assert.equal(claseSuperficie({ physics: { temperatureK: 4389 }, sp: 'K3II-III', m: -3.2, d: 151 }), 'gigante');
});

test('una componente de binaria anfitriona sin radio propio queda como marcador; la anfitriona conserva su radio', () => {
  const par = { i: 1, sp: 'M4V+DA', m: 12, c: 1.5, d: 20 };
  const a = { ...par, n: 'DP Leo A', physics: null }, b = { ...par, n: 'DP Leo B', physics: null };
  for (const r of [par, a, b]) r.components = [a, b];
  assert.equal(fisicaDibujo(a), null);
  assert.equal(fisicaDibujo(b), null);
  assert.ok(fisicaDibujo(par)?.radiusSolar > 0);
  const conRadio = { ...a, physics: { radiusSolar: 0.2, temperatureK: 3100 } };
  conRadio.components = [conRadio, b];
  assert.equal(fisicaDibujo(conRadio), conRadio.physics);
});

test('carbono, S y Wolf-Rayet (y LBV, hipergigante): la letra sale de la temperatura; enanas blancas, subenanas y O como antes', () => {
  // La Superba (C-N5, M_V ≈ −2,7): gigante, no enana.
  assert.equal(claseDibujo('C-N5', -2.7, 2650, 213), 'gigante');
  const uuAur = fisicaDibujo({ sp: 'C-N5-', m: -2.4, c: 2.6, d: 400 });
  assert.equal(uuAur.clase, 'gigante');
  assert.ok(uuAur.radiusSolar > 40, `${uuAur.radiusSolar}`);
  assert.equal(claseDibujo('S6+/1e', -1, 2700, 180), 'gigante');
  assert.equal(claseDibujo('WC8', -6, 40000, 340), 'gigante');
  assert.equal(claseDibujo('LBV', -8, 30000, 2300), 'hipergigante');
  // Una enana de carbono débil sigue siendo enana.
  assert.equal(claseDibujo('dC', 10, 4500, 100), 'enana');
  assert.equal(claseDibujo('DA2.9', 11, 17000, 5), 'enanaBlanca');
  assert.equal(claseDibujo('sdB5', 4, 30000, 200), 'subenana');
  assert.equal(claseDibujo('O9.5V', -4, 32000, 400), 'enana');
});

test('el radio típico no traga la órbita medida de una compañera; el medido no se toca', () => {
  // HD 166126: supergigante típica de ~98 R☉ y compañera B a 0,23 UA.
  const star = { i: 2, sp: 'K0Ib', m: -4.5, c: 1.1, d: 300 };
  star.system = { star, components: [{ pair: { of: 'A', k: 'o', a: 0.23, e: 0 } }, { pair: { of: 'A', k: 'w' } }] };
  const f = fisicaDibujo(star);
  assert.ok(Math.abs(f.radiusSolar - 0.4 * 0.23 * 215.03) < 0.5, `${f.radiusSolar}`);
  // La compañera con órbita propia también queda limitada por su periastro.
  const companera = { i: 3, sp: 'G8III', m: 0.5, d: 50 };
  const primaria = { i: 4, sp: 'G8III', m: 0.5, d: 50 };
  companera.sistemaDe = { star: primaria, components: [{ companion: companera, pair: { of: 'A', k: 'o', a: 0.1, e: 0.5 } }] };
  assert.ok(Math.abs(fisicaDibujo(companera).radiusSolar - 0.4 * 0.05 * 215.03) < 0.2);
  const medida = { i: 5, sp: 'K0Ib', m: -4.5, d: 300, datos: { radiusSolar: 90 } };
  medida.system = star.system;
  assert.equal(fisicaDibujo(medida).radiusSolar, 90);
});

test('una LBV (Eta Carinae) se dibuja como hipergigante a unos 15.000 K; la ficha no cambia', () => {
  assert.equal(claseDibujo('LBV', -1, 5000, 2300), 'hipergigante');
  const eta = fisicaDibujo({ sp: 'LBV', m: -1.2, c: 0.6, d: 2300 });
  assert.equal(eta.clase, 'hipergigante');
  assert.equal(eta.temperatureK, 15000);
  assert.ok(eta.dibujo && eta.radiusSolar > 50, `${eta.radiusSolar}`);
  // Con temperatura en los datos oficiales, esa manda.
  assert.equal(fisicaDibujo({ sp: 'LBV', m: -1.2, d: 2300, datos: { temperatureK: 20000 } }).temperatureK, 20000);
  // La física publicada (la ficha) no se toca.
  const physics = { radiusSolar: 100, temperatureK: 30000 };
  assert.equal(fisicaDibujo({ sp: 'LBV', physics }), physics);
});
