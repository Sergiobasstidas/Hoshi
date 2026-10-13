import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AU_TO_PC } from '../src/scene/scale.js';
import { apparentPosition, apastronAu, besselianYearToMjd, companionOffsetPc, companionOrbitPc } from '../src/scene/visualBinary.js';

const orbits = JSON.parse(readFileSync(new URL('../data/processed/binary_orbits.json', import.meta.url), 'utf8'));
const stars = JSON.parse(readFileSync(new URL('../data/processed/stars_15pc.json', import.meta.url), 'utf8'));
const byId = new Map(stars.map(star => [star.i, star]));
const SIRIUS = 584955, PROCYON = 749263, RIGIL_KENTAURUS = 1451193, TOLIMAN = 1451151;

test('Las órbitas reproducen las efemérides de ORB6 para 2026,0', () => {
  // Theta (grados) y rho (segundos de arco) de data/raw/multiplicity/orb6ephem.txt.
  for (const [id, theta, rho] of [[SIRIUS, 57.1, 11.163], [PROCYON, 353.7, 5.101], [RIGIL_KENTAURUS, 11.9, 9.294]]) {
    const star = byId.get(id);
    const position = apparentPosition(orbits[id], besselianYearToMjd(2026));
    // Los elementos están en el equinoccio 2000 (marco del catálogo); la efeméride da
    // theta en el equinoccio de la fecha. Corrección de precesión del ángulo de posición.
    const ra = Math.atan2(star.y, star.x), dec = Math.asin(star.z / Math.hypot(star.x, star.y, star.z));
    const precession = 0.00557 * Math.sin(ra) / Math.cos(dec) * 26;
    assert.ok(Math.abs(position.theta + precession - theta) < 0.06, `theta ${id}: ${position.theta + precession}`);
    assert.ok(Math.abs(position.rho / star.d - rho) < 0.01, `rho ${id}: ${position.rho / star.d}`);
  }
});

test('El índice de binarias solo contiene órbitas completas, fiables y cruzadas con el catálogo', () => {
  const entries = Object.entries(orbits);
  assert.ok(entries.length > 1000);
  for (const [id, orbit] of entries) {
    assert.ok(byId.has(Number(id)), id);
    assert.ok(orbit.grade >= 1 && orbit.grade <= 3);
    assert.ok(orbit.p > 0 && orbit.a > 0 && orbit.e >= 0 && orbit.e < 1);
    assert.ok([orbit.i, orbit.node, orbit.w, orbit.t].every(Number.isFinite));
    assert.ok(orbit.mass >= 0.05 && orbit.mass <= 150);
    assert.ok(orbit.ref && orbit.wds);
    if (orbit.companionId !== undefined) assert.ok(byId.has(orbit.companionId));
  }
  // Alfa Centauri B ya es un registro propio: no debe dibujarse una segunda vez.
  assert.equal(orbits[RIGIL_KENTAURUS].companionId, TOLIMAN);
  assert.equal(orbits[SIRIUS].companionId, undefined);
});

test('La compañera queda sobre su órbita, a escala y perpendicular a nada inventado', () => {
  const star = byId.get(SIRIUS), orbit = orbits[SIRIUS], position = [star.x, star.y, star.z];
  const offset = companionOffsetPc(orbit, position);
  const separationAu = Math.hypot(...offset) / AU_TO_PC;
  assert.ok(separationAu >= orbit.a * (1 - orbit.e) - 1e-9 && separationAu <= apastronAu(orbit) + 1e-9);
  const points = companionOrbitPc(orbit, position, 720);
  const nearest = Math.min(...points.map(p => Math.hypot(p[0] - offset[0], p[1] - offset[1], p[2] - offset[2])));
  assert.ok(nearest / AU_TO_PC < orbit.a * 0.01);
  assert.ok(Math.hypot(...points[0].map((v, i) => v - points.at(-1)[i])) / AU_TO_PC < 1e-9);
  // La posición del catálogo no se modifica.
  assert.deepEqual(position, [star.x, star.y, star.z]);
});
