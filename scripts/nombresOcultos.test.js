import test from 'node:test';
import assert from 'node:assert/strict';
import { hiddenBehind, screenDisk } from '../src/scene/labelOcclusion.js';

const disk = { key: 'Júpiter', x: 400, y: 300, radius: 200, distance: 10 };

test('un nombre lejano que cae sobre un planeta cercano se oculta', () => {
  assert.equal(hiddenBehind({ x: 450, y: 280, width: 80, height: 16 }, 50, [disk], 'Saturno'), true);
});

test('el nombre del propio cuerpo y los que están delante no se ocultan', () => {
  assert.equal(hiddenBehind({ x: 450, y: 280, width: 80, height: 16 }, 50, [disk], 'Júpiter'), false);
  assert.equal(hiddenBehind({ x: 450, y: 280, width: 80, height: 16 }, 5, [disk], 'Ío'), false);
});

test('un nombre fuera del disco sigue visible', () => {
  assert.equal(hiddenBehind({ x: 620, y: 300, width: 80, height: 16 }, 50, [disk], 'Saturno'), false);
  assert.equal(hiddenBehind({ x: 300, y: 120, width: 40, height: 16 }, 50, [disk], 'Saturno'), true);
});

test('el disco en pantalla depende del radio y la distancia', () => {
  const d = screenDisk('Sol', { x: 0, y: 0, z: -10 }, 1, { x: 400, y: 300 }, 600);
  assert.equal(d.radius, 60);
  assert.equal(screenDisk('Sol', { x: 0, y: 0, z: 10 }, 1, { x: 400, y: 300 }, 600), null);
  assert.equal(screenDisk('Sol', { x: 0, y: 0, z: -1000 }, 1, { x: 400, y: 300 }, 600), null);
});
