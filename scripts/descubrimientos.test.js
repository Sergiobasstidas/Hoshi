import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MISSIONS, PLANET_TYPES, TYPE_MASS_LIMITS, TYPE_RADIUS_LIMITS, countTabs, describeSystem, filterSystems, missionOf, planetType, typeFromNasa } from '../src/scene/descubrimientos.js';

const type = (mass, radius) => PLANET_TYPES[planetType(mass, radius)].id;

test('los límites de tipo reproducen fichas del catálogo de la NASA', () => {
  // Masa (M⊕) y radio (R⊕) del archivo y tipo de su ficha en science.nasa.gov.
  assert.equal(type(0.692, 0.92), 'terrestre'); // TRAPPIST-1 e
  assert.equal(type(1.039, 1.045), 'supertierra'); // TRAPPIST-1 f
  assert.equal(type(2.3, 1.51), 'supertierra'); // Kepler-138 c
  // Excepción conocida de la regla (≈ 4 % de las fichas): K2-18 b, 2,37 R⊕, es «super Earth» para la NASA.
  assert.equal(type(8.92, 2.37), 'neptuno');
  assert.equal(type(9.96, 3.13), 'neptuno'); // Kepler-1600 b
  assert.equal(type(10, 1.597), 'supertierra'); // Kepler-107 c
  assert.equal(type(30.5, 10.48), 'neptuno'); // WASP-107 b: hinchado, pero de poca masa
  assert.equal(type(37.9, 6.88), 'neptuno'); // Kepler-799 b
  assert.equal(type(38.14, 6.31), 'gigante'); // HATS-7 b
  assert.equal(type(null, null), 'desconocido');
});

test('los límites de masa y de radio son equivalentes por Chen y Kipping', () => {
  assert.deepEqual(TYPE_RADIUS_LIMITS, [1, 2.1, 6.9]);
  assert.equal(TYPE_MASS_LIMITS[0], 1);
  assert.ok(Math.abs(TYPE_MASS_LIMITS[1] - 5.06) < 0.02);
  assert.equal(TYPE_MASS_LIMITS[2], 38.14);
  // Un candidato solo con radio cae en la misma clase que un confirmado con esa masa.
  assert.equal(type(null, 6.9), 'gigante');
  assert.equal(type(null, 2.0), 'supertierra');
  assert.equal(type(5.1, null), 'neptuno');
  assert.equal(typeFromNasa('Neptune-like'), 1);
  assert.equal(typeFromNasa('super Earth'), 2);
});

test('la instalación de descubrimiento se agrupa en misiones', () => {
  const mission = (facility, locale) => MISSIONS[missionOf(facility, locale)].id;
  assert.equal(mission('Kepler', 'Space'), 'kepler');
  assert.equal(mission('Transiting Exoplanet Survey Satellite (TESS)', 'Space'), 'tess');
  assert.equal(mission('James Webb Space Telescope (JWST)', 'Space'), 'espacio');
  assert.equal(mission('La Silla Observatory', 'Ground'), 'tierra');
  assert.equal(mission('Multiple Observatories', 'Multiple Locales'), 'espacio');
});

test('filtros y recuentos por pestaña', () => {
  const data = {
    facilities: [{ n: 'Kepler', g: 0 }, { n: 'TESS', g: 2 }],
    systems: { n: ['A', 'B'], p: [1, 0, 0, 0, 3, 4], i: [7, -1], k: [5800, 0] },
    planets: { s: [0, 0, 1], t: [0, 2, 1], f: [0, 1, 1], c: [0, 1, 1] },
  };
  const all = { estado: 'todos', tipo: 'todos', mision: 'todas' };
  assert.deepEqual([...filterSystems(data, all).keys()], [0, 1]);
  assert.deepEqual([...filterSystems(data, { ...all, estado: 'confirmados' }).keys()], [0]);
  const tess = { ...all, mision: 'tess' };
  assert.deepEqual(filterSystems(data, tess).get(0), [1]);
  const counts = countTabs(data, tess);
  // La fila de misión cuenta sin su propio filtro; las demás, con él.
  assert.deepEqual(counts.mision, { todas: 3, kepler: 1, tess: 2 });
  assert.deepEqual(counts.estado, { todos: 2, candidatos: 2 });
  const info = describeSystem(data, 1, [2]);
  assert.equal(info.distancePc, 5);
  assert.equal(info.candidates, 1);
  assert.equal(info.inHoshi, false);
});

test('el mapa de descubrimientos es coherente y ligero', () => {
  const data = JSON.parse(fs.readFileSync('./public/data/exoplanet-discoveries.json', 'utf8'));
  const systems = data.systems.n.length;
  assert.equal(data.systems.p.length, systems * 3);
  assert.equal(data.systems.i.length, systems);
  assert.ok(data.systems.p.every(Number.isFinite));
  const planets = data.planets.s.length;
  for (const key of ['t', 'f', 'c']) assert.equal(data.planets[key].length, planets);
  assert.ok(data.planets.s.every(s => s >= 0 && s < systems));
  assert.ok(data.planets.f.every(f => f >= 0 && f < data.facilities.length));
  const confirmed = data.planets.c.filter(c => c === 0).length;
  assert.ok(confirmed > 6000 && planets - confirmed > 7000);
  // Carga aparte del bundle, solo al abrir el modo: mantenerla por debajo de 1 MB.
  assert.ok(fs.statSync('./public/data/exoplanet-discoveries.json').size < 1_000_000);
  // Un sistema que está en Hoshi usa la posición de su estrella del catálogo.
  const k = data.systems.n.indexOf('Proxima Cen');
  assert.ok(k >= 0 && data.systems.i[k] === 1436975);
  assert.deepEqual(data.systems.p.slice(k * 3, k * 3 + 3), [-0.47447, -0.36328, -1.1568]);
});

test('el acercamiento con inercia recorre lo mismo a cualquier frecuencia de cuadros', async () => {
  const { stepZoom, ZOOM_PER_NOTCH, ZOOM_DECAY_PER_S } = await import('../src/scene/inerciaCamara.js');
  const run = dt => {
    let velocity = ZOOM_PER_NOTCH * ZOOM_DECAY_PER_S, factor = 1;
    for (let t = 0; t < 3; t += dt) { const step = stepZoom(velocity, dt); velocity = step.velocity; factor *= step.factor; }
    return Math.log(factor);
  };
  // Una muesca acaba cambiando el logaritmo de la distancia en ZOOM_PER_NOTCH, a 30 o a 120 cuadros/s.
  assert.ok(Math.abs(run(1 / 30) - ZOOM_PER_NOTCH) < 1e-5);
  assert.ok(Math.abs(run(1 / 120) - ZOOM_PER_NOTCH) < 1e-5);
  // A los 0,2 s ya va más de la mitad: responde enseguida y frena poco a poco.
  const early = stepZoom(ZOOM_PER_NOTCH * ZOOM_DECAY_PER_S, 0.2);
  assert.ok(Math.log(early.factor) > ZOOM_PER_NOTCH * 0.6);
});
