import test from 'node:test';
import assert from 'node:assert/strict';
import { tipoEstelar } from '../src/tipoEstelar.js';

test('solo «D» mayúscula con su subtipo o «WD» es enana blanca; «d» y «sd» de SIMBAD son enanas y subenanas', () => {
  const nombre = sp => tipoEstelar(sp)?.nombre ?? null;
  assert.equal(nombre('DA2'), 'Enana blanca');
  assert.equal(nombre('DQ'), 'Enana blanca');
  assert.equal(nombre('DZ7.5'), 'Enana blanca');
  assert.equal(nombre('WD'), 'Enana blanca');
  assert.equal(nombre('dM4'), 'Enana roja');
  assert.equal(nombre('sdM7'), 'Subenana roja');
  assert.equal(nombre('d/sdM7'), 'Subenana roja');
  assert.equal(nombre('esdK7'), 'Subenana naranja');
  assert.equal(nombre('M5.5Ve'), 'Enana roja');
  assert.equal(nombre('G2 V'), 'Estrella amarilla');
  assert.equal(nombre('K1III'), 'Gigante naranja');
  assert.equal(nombre('A0mA1Va'), 'Estrella blanca');
  assert.equal(nombre(''), null);
  assert.equal(nombre(null), null);
});
