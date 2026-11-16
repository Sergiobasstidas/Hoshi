import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gruposSistema, redondeo } from '../src/scene/gruposSistema.js';

const systems = JSON.parse(readFileSync(new URL('../data/processed/star_systems.json', import.meta.url), 'utf8'));
const RIGIL_KENTAURUS = 1451193;
const comps = systems[RIGIL_KENTAURUS].comps;
const toliman = { i: 1451151, n: 'Toliman' }, proxima = { i: 1436975, n: 'Proxima Centauri' };
const sistema = { star: { i: RIGIL_KENTAURUS, n: 'Rigil Kentaurus', sp: 'G2V' }, components: [
  { name: 'B', pair: comps.find(c => c.n === 'B'), companion: toliman },
  { name: 'C', pair: comps.find(c => c.n === 'C'), companion: proxima },
] };

test('Alfa Centauri: Rigil Kentaurus y Toliman se orbitan y Proxima viaja más lejos', () => {
  const { pares, lejanas } = gruposSistema(sistema);
  assert.equal(pares.length, 1);
  assert.equal(pares[0].uno.nombre, 'Rigil Kentaurus');
  assert.equal(pares[0].otro.nombre, 'Toliman');
  assert.ok(Math.abs(pares[0].periodo - 79.76) < 0.01);
  assert.equal(lejanas.length, 1);
  assert.equal(lejanas[0].miembro.nombre, 'Proxima Centauri');
  assert.equal(lejanas[0].de.nombre, 'Rigil Kentaurus');
  assert.equal(lejanas[0].par, pares[0]);
  assert.equal(redondeo(lejanas[0].veces), 450);
});

test('Un sistema sin pareja con órbita solo tiene compañeras lejanas', () => {
  const { pares, lejanas } = gruposSistema({ star: { i: 1, n: 'X', d: 10 }, position: [0, 0, 0], components: [{ name: 'B', pair: { n: 'B', of: 'A', k: 'w', rho: 300 }, companion: null, offsetPc: [0, 0, 0] }] });
  assert.equal(pares.length, 0);
  assert.equal(lejanas[0].veces, null);
  assert.deepEqual(gruposSistema(null), { pares: [], lejanas: [] });
});

test('El redondeo deja dos cifras', () => {
  assert.equal(redondeo(449.3), 450);
  assert.equal(redondeo(10520), 11000);
  assert.equal(redondeo(7.4), 7);
});
