import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { paralajeComun, sistemasConEstrellaNueva } from './catalog/distancia_sistemas.js';

test('la paralaje común pondera por el inverso del error al cuadrado', () => {
  const c = paralajeComun([{ plx: 100, err: 1 }, { plx: 110, err: 2 }, null]);
  assert.ok(Math.abs(c.plx - (100 * 1 + 110 * 0.25) / 1.25) < 1e-9);
  assert.equal(c.n, 2);
  assert.equal(paralajeComun([{ plx: 50, err: 1 }]).plx, 50);
  assert.equal(paralajeComun([null, { plx: -3, err: 1 }]), null);
});

test('los sistemas con compañeras del registro comparten distancia; α Centauri queda curada', () => {
  const stars = new Map(JSON.parse(fs.readFileSync('data/processed/stars_15pc.json', 'utf8')).map(s => [s.i, s]));
  const sistemas = JSON.parse(fs.readFileSync('data/processed/star_systems.json', 'utf8'));
  const grupos = sistemasConEstrellaNueva(sistemas);
  assert.ok(grupos.length > 850);
  // Las componentes con paralaje que no concuerda conservan la suya: casi todos los sistemas quedan con una sola distancia.
  const juntos = grupos.filter(ids => { const d = ids.map(i => stars.get(i)?.d).filter(Boolean); return d.every(x => Math.abs(x - d[0]) / d[0] < 1e-6); });
  assert.ok(juntos.length > grupos.length * 0.95, `${juntos.length} de ${grupos.length}`);
  assert.equal(stars.get(1451193).d, 1.338382);
  assert.equal(stars.get(1451151).d, 1.338382);
  assert.equal(stars.get(584955).d, stars.get(100001806).d);
});
