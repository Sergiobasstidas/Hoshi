import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { julianDay, laplaceBasis, moonOffsetKm, SATURN_RING_BASIS } from '../src/scene/moonEphemeris.js';
import { buildMoonBodies, hiddenByPlanet } from '../src/scene/moonBodies.js';
import { D_RING_PARTICLES, RING_REGIONS, regionAt, sampleRingParticles } from '../src/scene/ringParticles.js';

const moons = JSON.parse(fs.readFileSync(new URL('../public/data/moons.json', import.meta.url))).moons;
const rings = JSON.parse(fs.readFileSync(new URL('../public/data/saturn_rings.json', import.meta.url)));
const angle = (a, b) => Math.acos((a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / Math.hypot(...a) / Math.hypot(...b)) * 180 / Math.PI;

test('lunas: todas las de JPL de Júpiter y Saturno, con tamaño y procedencia', () => {
  assert.equal(moons.filter(moon => moon.planet === 'Júpiter').length, 115);
  assert.equal(moons.filter(moon => moon.planet === 'Saturno').length, 291);
  for (const moon of moons) {
    assert.ok(moon.radiusKm > 0, moon.name);
    assert.ok(['jpl', 'published', 'estimated'].includes(moon.size), moon.name);
  }
  assert.equal(moons.find(moon => moon.name === 'Ganimedes').radiusKm, 2631.2);
  assert.equal(moons.find(moon => moon.name === 'Titán').size, 'jpl');
});

test('lunas: posición calculable en todo el intervalo de elementos (2026-09 a 2030-01)', () => {
  for (let jd = 2461284.5; jd <= 2462502.5; jd += 7) {
    for (const moon of moons) assert.ok(moonOffsetKm(moon, jd).every(Number.isFinite), `${moon.name} en ${jd}`);
  }
});

// Vectores de JPL Horizons (centro del planeta, ICRF, km) del 14/02/2027 0 h TDB, consultados el
// 14/10/2026. Esta fecha no se usó al generar los datos.
const HORIZONS_2027_02_14 = {
  'Ío': [330651, 235305, 117617], Europa: [630559, -221490, -90212], Ganimedes: [803489, 631510, 316034],
  Calisto: [20710, -1705023, -803232], Himalia: [3175946, -7796365, -9898715], 'Pasífae': [7881327, 15582496, 9242289],
  Mimas: [-130615, 127038, 2975], 'Encélado': [236050, 11315, -21104], Rea: [154928, 501076, -52157],
  'Titán': [-1050537, -657521, 137160], 'Jápeto': [-3539168, 462646, 790113], Febe: [-11353482, -3061389, 232327],
  Jano: [88980, 120901, -16899], 'S/2023 S 38': [4094350, -17362631, -3497067],
};

test('lunas: dirección desde el planeta a menos de 2,5° de Horizons en una fecha de comprobación', () => {
  for (const [name, expected] of Object.entries(HORIZONS_2027_02_14)) {
    const moon = moons.find(item => item.name === name);
    const offset = moonOffsetKm(moon, 2461450.5);
    assert.ok(angle(offset, expected) < 2.5, `${name}: ${angle(offset, expected).toFixed(2)}°`);
    assert.ok(Math.abs(Math.hypot(...offset) / Math.hypot(...expected) - 1) < 0.05, `${name}: distancia`);
  }
});

test('lunas: cuerpos navegables junto a su planeta y fecha juliana', () => {
  assert.equal(julianDay(new Date(Date.UTC(2000, 0, 1, 12))), 2451545);
  const bodies = buildMoonBodies(moons, new Date(Date.UTC(2026, 9, 14)));
  const titan = bodies.find(body => body.name === 'Titán');
  assert.equal(titan.kind, 'satellite');
  assert.equal(titan.planet, 'Saturno');
  assert.ok(titan.minDistancePc > titan.radiusKm * 1e-14);
  assert.equal(new Set(bodies.map(body => body.optionValue)).size, bodies.length);
});

test('lunas: el planeta tapa lo que queda detrás y no lo que queda delante', () => {
  assert.equal(hiddenByPlanet(0, 0, 10, [0, 0, -5], 1), true);
  assert.equal(hiddenByPlanet(0, 0, 10, [0, 0, 5], 1), false);
  assert.equal(hiddenByPlanet(0, 0, 10, [3, 0, -5], 1), false);
});

test('marcos: el plano de Laplace y el de los anillos tienen el polo como Z', () => {
  const [x, , z] = laplaceBasis(40.589, 83.537);
  const ra = 40.589 * Math.PI / 180, dec = 83.537 * Math.PI / 180;
  [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)].forEach((value, i) => assert.ok(Math.abs(z[i] - value) < 1e-12));
  assert.ok(Math.abs(x[2]) < 1e-12);
  assert.deepEqual(SATURN_RING_BASIS[2], z);
});

test('anillos: el perfil de Cassini distingue B, Cassini, A y la división de Encke', () => {
  const at = radius => rings.tau[Math.round((radius - rings.r0) / rings.dr)];
  const median = (inner, outer) => {
    const values = rings.tau.filter((_, i) => rings.r0 + i * rings.dr >= inner && rings.r0 + i * rings.dr < outer).sort((a, b) => a - b);
    return values[values.length >> 1];
  };
  assert.ok(median(92000, 117500) > 1.5, 'anillo B opaco');
  assert.ok(median(118000, 122000) < 0.2, 'división de Cassini');
  assert.ok(median(122400, 133000) > 0.4, 'anillo A');
  assert.ok(median(75000, 91000) < 0.2, 'anillo C');
  assert.ok(Math.min(...[133500, 133550, 133600, 133650].map(at)) < 0.05, 'división de Encke');
});

test('anillos: las partículas siguen 1 − e^(−τ) y se quedan entre los bordes', () => {
  const sample = sampleRingParticles(rings, 200000);
  assert.equal(sample.count, 200000 + D_RING_PARTICLES);
  const counts = {};
  for (let k = 0; k < sample.count; k++) {
    const radius = Math.hypot(sample.position[k * 3], sample.position[k * 3 + 1]);
    assert.ok(radius >= RING_REGIONS[0].inner - 10 && radius <= 140720, `${radius}`);
    assert.equal(sample.position[k * 3 + 2], 0);
    counts[regionAt(radius).id] = (counts[regionAt(radius).id] || 0) + 1;
  }
  // Por unidad de área, B lleva más que A, A más que C y C más que la división de Cassini.
  const area = id => { const r = RING_REGIONS.find(region => region.id === id); return r.outer ** 2 - r.inner ** 2; };
  const density = id => counts[id] / area(id);
  assert.ok(density('B') > density('A') && density('A') > density('C') && density('C') > density('Cassini') * 0.5);
  // Reproducible entre cargas.
  assert.deepEqual(sampleRingParticles(rings, 1000).position.slice(0, 30), sampleRingParticles(rings, 1000).position.slice(0, 30));
});

test('estelas: siguen la trayectoria real y se desvanecen de la cola a la cabeza', async () => {
  const { sampleTrail, mergeTrails } = await import('../src/scene/fadingTrail.js');
  const io = moons.find(moon => moon.name === 'Ío');
  const end = 2461450.5, span = 360 / io.n / 2;
  const points = sampleTrail(jd => moonOffsetKm(io, jd), end, span, 25);
  // La cabeza coincide con la luna en la fecha y la cola, con su posición media vuelta antes.
  const head = moonOffsetKm(io, end), tail = moonOffsetKm(io, end - span);
  [0, 1, 2].forEach(i => assert.ok(Math.abs(points[72 + i] - head[i]) < 1 && Math.abs(points[i] - tail[i]) < 1));
  assert.ok(angle(head, tail) > 170);
  const merged = mergeTrails([{ points, color: [1, 1, 1], size: 1 }]);
  assert.equal(merged.position.length, 24 * 6);
  assert.equal(merged.progress[0], 0);
  assert.equal(merged.progress.at(-1), 1);
});
