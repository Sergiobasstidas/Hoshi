import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchIndex, normalizeStarQuery, searchStars } from '../src/scene/starSearch.js';

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

test('un nombre con letra de componente lleva a la estrella de su sistema', () => {
  const indice = buildSearchIndex([[1, ['HIP 26579', 'HD 37525']], [2, ['HIP 28393', 'HD 41004 A']], [3, ['HD 41004 B']], [4, ['HIP 108859', 'HD 209458']]]);
  const primera = consulta => searchStars(indice, consulta)[0];
  for (const consulta of ['HD 37525Ab', 'hd 37525ab', 'HD 37525 B', 'HD 37525A', 'HD 37525AB', '(HD 37525Ab).']) assert.equal(primera(consulta)?.id, 1, consulta);
  assert.equal(primera('HD 37525Ab').matched, 'HD 37525');
  assert.equal(primera('HD 41004 B').id, 3);
  assert.equal(primera('HD 209458 b'), undefined);
  assert.equal(primera('HD 209458 b.'), undefined);
});
