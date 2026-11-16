import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { anomaliaEn, cruces, escalas, parConOrbita, proximoPaso, relativa, velocidadRelativa } from '../src/scene/orbitasPar.js';

const systems = JSON.parse(readFileSync(new URL('../data/processed/star_systems.json', import.meta.url), 'utf8'));
const RIGIL_KENTAURUS = 1451193;
const pair = systems[RIGIL_KENTAURUS].comps.find(c => c.pair === 'RHD 1');
const sistema = { star: { i: RIGIL_KENTAURUS, n: 'Rigil Kentaurus' }, components: [{ name: 'B', pair, companion: { i: 1451151, n: 'Toliman' } }] };
const orbita = parConOrbita({ system: sistema });

test('Alfa Centauri tiene página de órbitas con los elementos de ORB6', () => {
  assert.equal(orbita.primaria.nombre, 'Rigil Kentaurus');
  assert.equal(orbita.companera.nombre, 'Toliman');
  assert.ok(Math.abs(orbita.periodo - 79.76) < 0.01);
  assert.equal(parConOrbita({ system: sistema }), orbita, 'se reutiliza el mismo objeto');
  assert.equal(parConOrbita({ i: 1 }), null);
});

test('El próximo acercamiento es en 2035 y el máximo alejamiento en 2075', () => {
  const cerca = proximoPaso(orbita, 2026.85), lejos = proximoPaso(orbita, 2026.85, orbita.periodo / 2);
  assert.equal(Math.floor(cerca), 2035);
  assert.equal(Math.floor(lejos), 2075);
  const [x, y] = relativa(orbita, anomaliaEn(orbita, cerca));
  assert.ok(Math.abs(Math.hypot(x, y) - orbita.a * (1 - orbita.e)) < 1e-6);
  assert.ok(velocidadRelativa(orbita, 0) / velocidadRelativa(orbita, Math.PI) > 3);
});

test('Las dos estrellas quedan en lados opuestos del centro de masa', () => {
  const q = 0.4573, s = escalas(0, q);
  assert.ok(s.primaria < 0 && s.companera > 0);
  assert.ok(Math.abs(-s.primaria / s.companera - q / (1 - q)) < 1e-12);
  assert.ok(Math.abs(escalas(1, q).primaria) < 1e-12);
  assert.equal(cruces(orbita, q).length, 2);
});
