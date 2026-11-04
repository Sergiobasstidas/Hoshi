import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStarQuery } from '../src/scene/starSearch.js';

test('el buscador entiende un mismo nombre escrito de muchas formas', () => {
  const iguales = [
    ['Épsilon Orionis', 'ε Ori', 'Eps Ori', 'épsilon de Orión', 'eps-ori'],
    ['Zeta Ursae Majoris', 'Zet UMa', 'zeta de la Osa Mayor'],
    ['61 Cygni', '61 Cyg', '61 del Cisne'],
    ['Gliese 581', 'GJ 581', 'Gl 581'],
    ['VY Canis Majoris', 'VY CMa', 'vy can mayor'],
    ['Alfa Centauri', 'α Cen', 'Alpha Centauri'],
  ];
  for (const formas of iguales) for (const forma of formas) assert.equal(normalizeStarQuery(forma), normalizeStarQuery(formas[0]), forma);
  assert.equal(normalizeStarQuery('HD-39801'), 'hd39801');
});
