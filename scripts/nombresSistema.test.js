import test from 'node:test';
import assert from 'node:assert/strict';
import { selectStarLabels } from '../src/scene/starLabelSelection.js';

const RIGIL = 1451193, TOLIMAN = 1451151;
const par = apilado => [
  { id: RIGIL, sistema: RIGIL, width: 90, x: 409, y: 92, distance: 1 },
  { id: TOLIMAN, sistema: RIGIL, width: 45, x: 412, y: 107, distance: 1.01, apilado },
];

test('Los nombres apilados de un mismo sistema se muestran los dos, cada uno con el suyo', () => {
  const vistos = selectStarLabels(par(true), new Set(), null);
  assert.deepEqual([...vistos].sort(), [TOLIMAN, RIGIL].sort());
  assert.equal(vistos.juntos, undefined);
});

test('Sin apilar, dos nombres encimados siguen compitiendo por el lugar', () => {
  assert.equal(selectStarLabels(par(false), new Set(), null).size, 1);
});
