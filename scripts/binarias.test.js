import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AU_TO_PC } from '../src/scene/scale.js';
import { apparentPosition, apastronAu, barycentricOrbitsPc, besselianYearToMjd, buildStarSystems, companionColor, companionOffsetPc, companionOrbitPc,
  companionSizePx, NEUTRAL_COMPANION_COLOR } from '../src/scene/visualBinary.js';
import { parseComponents } from './multiplicity.js';

const systems = JSON.parse(readFileSync(new URL('../data/processed/star_systems.json', import.meta.url), 'utf8'));
const stars = JSON.parse(readFileSync(new URL('../data/processed/stars_15pc.json', import.meta.url), 'utf8'));
const byId = new Map(stars.map(star => [star.i, star]));
const SIRIUS = 584955, PROCYON = 749263, RIGIL_KENTAURUS = 1451193, TOLIMAN = 1451151, CASTOR = 735275, MIZAR = 1343569;
const orbitOf = (id, name = 'B') => systems[id].comps.find(c => c.n === name && c.k === 'o');

test('Las órbitas reproducen las efemérides de ORB6 para 2026,0', () => {
  // Theta (grados) y rho (segundos de arco) de data/raw/multiplicity/orb6ephem.txt.
  for (const [id, theta, rho] of [[SIRIUS, 57.1, 11.163], [PROCYON, 353.7, 5.101], [RIGIL_KENTAURUS, 11.9, 9.294]]) {
    const star = byId.get(id);
    const position = apparentPosition(orbitOf(id), besselianYearToMjd(2026));
    // Los elementos están en el equinoccio 2000 (marco del catálogo); la efeméride da
    // theta en el equinoccio de la fecha. Corrección de precesión del ángulo de posición.
    const ra = Math.atan2(star.y, star.x), dec = Math.asin(star.z / Math.hypot(star.x, star.y, star.z));
    const precession = 0.00557 * Math.sin(ra) / Math.cos(dec) * 26;
    assert.ok(Math.abs(position.theta + precession - theta) < 0.06, `theta ${id}: ${position.theta + precession}`);
    assert.ok(Math.abs(position.rho / star.d - rho) < 0.01, `rho ${id}: ${position.rho / star.d}`);
  }
});

test('El índice de sistemas solo contiene pares fiables, completos y cruzados con el catálogo', () => {
  const entries = Object.entries(systems);
  assert.ok(entries.length > 4000);
  for (const [id, entry] of entries) {
    assert.ok(byId.has(Number(id)), id);
    assert.ok(entry.wds && entry.comps.length > 0);
    const placed = new Set(['A']);
    for (const pair of entry.comps) {
      // Cada componente se ancla en otra ya colocada y no se repite.
      assert.ok(placed.has(pair.of) && !placed.has(pair.n), `${id} ${pair.of}>${pair.n}`);
      placed.add(pair.n);
      if (pair.k === 'o') {
        assert.ok(pair.grade >= 1 && pair.grade <= 3);
        assert.ok(pair.p > 0 && pair.a > 0 && pair.e >= 0 && pair.e < 1);
        assert.ok([pair.i, pair.node, pair.w, pair.t].every(Number.isFinite));
        assert.ok(pair.mass >= 0.05 && pair.mass <= 150 && pair.ref);
      } else {
        assert.equal(pair.k, 'w');
        assert.ok(pair.rho > 0 && pair.rho <= 20000 && pair.theta >= 0 && pair.theta <= 360);
      }
      if (pair.cid !== undefined) assert.ok(byId.has(pair.cid) && pair.cid !== Number(id));
    }
  }
  assert.equal(orbitOf(RIGIL_KENTAURUS).cid, TOLIMAN);
  assert.equal(orbitOf(SIRIUS).cid, undefined);
  assert.equal(orbitOf(SIRIUS).sp, 'DA2');
  // Castor: par interior Aa-Ab, par AB, par interior de B y la compañera ancha C.
  assert.deepEqual(systems[CASTOR].comps.map(c => `${c.of}>${c.n}:${c.k}`).sort(), ['A>Ab:o', 'A>B:o', 'A>C:w', 'B>Bb:o']);
  // El MSC aporta masas estimadas a los pares ya dibujados y lista lo que no se puede situar.
  const castorB = systems[CASTOR].comps.find(c => c.n === 'B');
  assert.ok(castorB.m1 > castorB.m2 && castorB.m2 > 1);
  assert.ok(systems[CASTOR].hidden.every(item => item.of === 'C'));
  for (const entry of Object.values(systems)) {
    const names = new Set(['A', ...entry.comps.map(c => c.n)]);
    for (const item of entry.hidden || []) assert.ok(names.has(item.of) && !names.has(item.n));
  }
  // Próxima es la componente C de Alfa Centauri y ya es un registro del catálogo.
  assert.equal(byId.get(systems[RIGIL_KENTAURUS].comps.find(c => c.n === 'C').cid).n, 'Proxima Centauri');
  assert.equal(byId.get(systems[MIZAR].comps.find(c => c.n === 'C').cid).n, 'Alcor');
});

test('Los componentes de un par se leen de las designaciones de ORB6 y WDS', () => {
  assert.deepEqual(parseComponents('AB'), ['A', 'B']);
  assert.deepEqual(parseComponents(''), ['A', 'B']);
  assert.deepEqual(parseComponents('Aa,Ab'), ['Aa', 'Ab']);
  assert.deepEqual(parseComponents('AB,C'), ['AB', 'C']);
  assert.deepEqual(parseComponents('BC '), ['B', 'C']);
  assert.equal(parseComponents('ABC'), null);
  assert.equal(parseComponents('9831'), null);
});

test('Las jerarquías se encadenan y las compañeras del catálogo quedan sobre su órbita', () => {
  const copy = new Map(stars.map(star => [star.i, { ...star }]));
  const built = new Map(buildStarSystems(systems, copy).map(system => [system.id, system]));
  const castor = built.get(CASTOR), byName = Object.fromEntries(castor.components.map(c => [c.name, c]));
  // Bb cuelga de B, no de A.
  assert.deepEqual(byName.Bb.parentOffsetPc, byName.B.offsetPc);
  assert.ok(Math.hypot(...byName.Bb.offsetPc.map((v, i) => v - byName.B.offsetPc[i])) / AU_TO_PC < 0.2);
  assert.ok(byName.B.separationAu > 50 && byName.B.separationAu < 200);
  assert.ok(castor.framePc > byName.B.scalePc * 0.99 && castor.framePc < 2500 * AU_TO_PC);
  // Toliman pasa a la posición orbital del modelo; Rigil Kentaurus no se mueve.
  const a = copy.get(RIGIL_KENTAURUS), b = copy.get(TOLIMAN), original = byId.get(RIGIL_KENTAURUS);
  assert.deepEqual([a.x, a.y, a.z], [original.x, original.y, original.z]);
  const separationAu = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / AU_TO_PC, orbit = orbitOf(RIGIL_KENTAURUS);
  assert.ok(separationAu >= orbit.a * (1 - orbit.e) - 1e-6 && separationAu <= apastronAu(orbit) + 1e-6);
  // Sin relación con el catálogo no se toca ninguna otra estrella.
  let moved = 0;
  for (const star of stars) { const c = copy.get(star.i); if (c.x !== star.x || c.y !== star.y || c.z !== star.z) moved++; }
  assert.ok(moved > 0 && moved < 80, String(moved));
});

test('Con masas, las dos órbitas rodean el centro de masas sin mover a ninguna estrella', () => {
  const star = byId.get(CASTOR), pair = orbitOf(CASTOR), position = [star.x, star.y, star.z];
  const q = pair.m2 / (pair.m1 + pair.m2), now = companionOffsetPc(pair, position);
  const { centre, primary, companion } = barycentricOrbitsPc(pair, position, q, undefined, 720);
  const nearest = (points, target) => Math.min(...points.map(p => Math.hypot(...p.map((v, i) => v - target[i])))) / AU_TO_PC;
  // La primaria (en el origen) y la compañera (en su posición relativa) quedan sobre sus curvas.
  assert.ok(nearest(primary, [0, 0, 0]) < pair.a * 0.01);
  assert.ok(nearest(companion, now) < pair.a * 0.01);
  // El centro de masas divide la separación según las masas.
  assert.ok(Math.abs(Math.hypot(...centre) / Math.hypot(...now) - q) < 1e-12);
  // Las curvas guardan la proporción de masas en cada punto.
  for (const i of [0, 100, 400]) {
    const a = Math.hypot(...primary[i].map((v, k) => v - centre[k])), b = Math.hypot(...companion[i].map((v, k) => v - centre[k]));
    assert.ok(Math.abs(a / b - pair.m2 / pair.m1) < 1e-9);
  }
});

test('El color y el tamaño del marcador salen del tipo espectral y la magnitud, sin inventar', () => {
  assert.deepEqual(companionColor(undefined), NEUTRAL_COMPANION_COLOR);
  assert.deepEqual(companionColor('??'), NEUTRAL_COMPANION_COLOR);
  assert.notDeepEqual(companionColor('DA2'), companionColor('dM2'));
  assert.deepEqual(companionColor('dM2'), companionColor('M0.5V'));
  assert.equal(companionSizePx(undefined, 10), 7);
  assert.ok(companionSizePx(1.33, 1.3248) > companionSizePx(8.44, 2.6371));
  assert.ok(companionSizePx(30, 10) >= 4 && companionSizePx(-10, 10) <= 14);
});

test('La compañera queda sobre su órbita y a escala', () => {
  const star = byId.get(SIRIUS), orbit = orbitOf(SIRIUS), position = [star.x, star.y, star.z];
  const offset = companionOffsetPc(orbit, position);
  const separationAu = Math.hypot(...offset) / AU_TO_PC;
  assert.ok(separationAu >= orbit.a * (1 - orbit.e) - 1e-9 && separationAu <= apastronAu(orbit) + 1e-9);
  const points = companionOrbitPc(orbit, position, 720);
  const nearest = Math.min(...points.map(p => Math.hypot(p[0] - offset[0], p[1] - offset[1], p[2] - offset[2])));
  assert.ok(nearest / AU_TO_PC < orbit.a * 0.01);
  assert.ok(Math.hypot(...points[0].map((v, i) => v - points.at(-1)[i])) / AU_TO_PC < 1e-9);
});
