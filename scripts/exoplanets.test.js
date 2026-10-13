import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WR140_ORBIT, eccentricAnomaly, relativeOrbitAu } from '../src/scene/binaryOrbit.js';
import { PerspectiveCamera, Vector3 } from 'three';
import { bodyView } from '../src/scene/solarBodies.js';
import { advanceJourney, beginJourney } from '../src/scene/navigation.js';
import { ARRIVAL_TILT_DEG, PLANET_VIEW_ELEVATION_DEG, PLANET_VIEW_RADII, ASSUMED_INCLINATION_DEG, EXOPLANET_EPOCH_JD, orbitNormal, buildPlanetarySystems, keplerPeriodDays, keplerSemiMajorAu,
  meanAnomalyAt, orbitalPlaneToEquatorial, planetOffsetAu, planetStateAu, resolvePlanet, skyDirection,
  transitEccentricAnomaly } from '../src/scene/exoplanetOrbit.js';
import { applyDistance, applyPatches } from './catalog/catalog_patches.js';
import { ADDED_HOST_ID_BASE, buildHost, propagateToJ2000 } from './catalog/build_added_hosts.js';
import { decideDistance } from './catalog/build_distance_corrections.js';
import { bvToTemperature, temperatureToBv, vFromGaia } from './catalog/photometry.js';

const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const close = (actual, expected, tolerance, message) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message || ''} ${actual} ≠ ${expected}`);
const skyAt = (raDeg, decDeg, d = 10) => {
  const ra = raDeg * Math.PI / 180, dec = decDeg * Math.PI / 180;
  return { raDeg, decDeg, x: d * Math.cos(dec) * Math.cos(ra), y: d * Math.cos(dec) * Math.sin(ra), z: d * Math.sin(dec) };
};
const towardSun = sky => [-sky.x, -sky.y, -sky.z].map(v => v / Math.hypot(sky.x, sky.y, sky.z));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

test('La conversión de elementos al marco ecuatorial coincide con la órbita publicada de WR 140', () => {
  const o = WR140_ORBIT;
  for (const E of [0, 0.7, Math.PI / 2, 2.4, Math.PI, 5.1]) {
    const x = o.semiMajorAu * (Math.cos(E) - o.eccentricity), y = o.semiMajorAu * Math.sqrt(1 - o.eccentricity ** 2) * Math.sin(E);
    const actual = orbitalPlaneToEquatorial(x, y, { omegaDeg: o.omegaWrDeg + 180, nodeDeg: o.nodeDeg, inclinationDeg: o.inclinationDeg, raDeg: o.raHours * 15, decDeg: o.decDeg });
    relativeOrbitAu(E).forEach((value, i) => close(actual[i], value, 1e-12));
  }
});

test('Un caso conocido: órbita circular de canto con Ω = 0 queda en el plano norte–visual', () => {
  // Estrella en RA 0, Dec 0: la visual es +X, el este +Y y el norte +Z.
  const sky = skyAt(0, 0), planet = { a: 1, e: 0, inc: 90, w: 0 };
  for (let k = 0; k < 16; k++) {
    const p = planetOffsetAu(k / 16 * 2 * Math.PI, planet, sky);
    close(p[1], 0, 1e-12, 'sin componente este');
    close(Math.hypot(...p), 1, 1e-12, 'radio');
  }
  // De frente (i = 0) la órbita queda en el plano del cielo: sin componente visual.
  close(planetOffsetAu(1.1, { a: 1, e: 0.3, inc: 0, w: 40 }, sky)[0], 0, 1e-12);
});

test('En t0 el planeta queda delante de la estrella visto desde el Sol', () => {
  for (const [raDeg, decDeg] of [[0, 0], [346.6, -5.04], [120, 62], [233, -41]]) {
    const sky = skyAt(raDeg, decDeg, 12.4);
    for (const planet of [{ a: 0.0115, P: 1.510826, e: 0.00622, inc: 89.73, w: 336.9 }, { a: 0.2, P: 61.1, e: 0.4, inc: 59, w: 50.3 },
      { a: 1.3, P: 400, e: 0.7, inc: 120, w: 200 }, { a: 0.05, P: 3, e: 0, inc: 87, w: 0 }]) {
      const withPhase = { ...planet, t: ['t0', 2457322.514] };
      const position = planetStateAu(withPhase, sky, 2457322.514);
      const sunward = dot(position, towardSun(sky));
      assert.ok(sunward > 0, 'del lado del Sol');
      // Distancia proyectada a la visual: como mucho a·cos i (parámetro de impacto en unidades de órbita).
      const projected = Math.sqrt(Math.max(0, dot(position, position) - sunward ** 2));
      assert.ok(projected <= Math.hypot(...position) * Math.abs(Math.cos(planet.inc * Math.PI / 180)) + 1e-6, `proyectada ${projected}`);
      // Coincide con la conjunción inferior analítica: ν = 90° − ω.
      const nu = (90 - planet.w) * Math.PI / 180;
      const analytic = 2 * Math.atan2(Math.sqrt(1 - planet.e) * Math.sin(nu / 2), Math.sqrt(1 + planet.e) * Math.cos(nu / 2));
      const found = transitEccentricAnomaly(planet, sky);
      if (planet.e > 0) close(Math.cos(found - analytic), 1, 1e-9, 'anomalía del tránsito');
    }
  }
  // Un tránsito real de canto pasa por delante del disco: TRAPPIST-1 b a menos de un radio estelar.
  const sky = skyAt(346.62, -5.04, 12.47), b = { a: 0.01154, P: 1.510826, e: 0.00622, inc: 89.73, w: 336.9, t: ['t0', 2457322.514] };
  const p = planetStateAu(b, sky, 2457322.514), s = dot(p, towardSun(sky));
  assert.ok(Math.sqrt(dot(p, p) - s * s) * 149597870.7 < 0.1192 * 695700);
});

test('La fase se propaga con el período y vuelve al mismo punto tras un ciclo', () => {
  const sky = skyAt(343.32, -14.27, 4.67), planet = { a: 0.2083, P: 61.1166, e: 0.0324, inc: 59, w: 50.3, t: ['t0', 2453055.984] };
  const start = planetStateAu(planet, sky, 2453055.984), cycle = planetStateAu(planet, sky, 2453055.984 + 61.1166 * 7);
  start.forEach((value, i) => close(cycle[i], value, 1e-9));
  const half = planetStateAu(planet, sky, 2453055.984 + 61.1166 / 2);
  assert.ok(dot(half, towardSun(sky)) < 0, 'medio período después está detrás');
  close(meanAnomalyAt(planet, sky, 2453055.984 + 61.1166 / 4) - meanAnomalyAt(planet, sky, 2453055.984), Math.PI / 2, 1e-9);
  // Con tiempo de periastro, M = 0 y distancia a(1 − e) en esa fecha.
  const eccentric = { a: 2, P: 900, e: 0.5, inc: 60, w: 30, t: ['tp', 2451000] };
  assert.equal(meanAnomalyAt(eccentric, sky, 2451000), 0);
  close(Math.hypot(...planetStateAu(eccentric, sky, 2451000)), 1, 1e-12);
  close(Math.hypot(...planetStateAu(eccentric, sky, 2451450)), 3, 1e-9);
  assert.equal(meanAnomalyAt({ ...eccentric, t: null }, sky), null);
  close(Math.abs(eccentricAnomaly(Math.PI, 0.5)), Math.PI, 1e-12);
});

test('Los elementos ausentes se completan con supuestos declarados, nunca en silencio', () => {
  const base = { n: 'X b', a: 0.1, P: 10, e: 0.1, inc: 88, w: 90, tp: null, t0: 2455000, r: 2, teq: 500, m: 5, mp: 'Mass', f: { tr: true }, calc: [] };
  assert.equal(resolvePlanet(base, 1).s, '');
  const radial = resolvePlanet({ ...base, e: null, inc: null, w: null, t0: null, f: { tr: false }, calc: ['pl_rade'] }, 1);
  assert.deepEqual([radial.e, radial.inc, radial.w, radial.t], [0, ASSUMED_INCLINATION_DEG, 0, null]);
  assert.equal(radial.s, 'eifr');
  assert.equal(resolvePlanet({ ...base, inc: null }, 1).inc, 90);
  // Sin inclinación propia pero con planetas medidos en el sistema: se supone su plano, y se declara.
  const coplanar = resolvePlanet({ ...base, inc: null, f: { tr: false } }, 1, false, 85.1);
  assert.deepEqual([coplanar.inc, coplanar.s], [85.1, 'k']);
  assert.ok(resolvePlanet({ ...base, inc: null }, 1).s.includes('t'));
  assert.ok(resolvePlanet({ ...base, e: 0 }, 1).s.includes('c'));
  // Semieje por Kepler: 1 año alrededor de 1 M☉ es 1 UA.
  close(keplerSemiMajorAu(365.25, 1), 1, 1e-12);
  close(keplerPeriodDays(1, 1), 365.25, 1e-9);
  const derived = resolvePlanet({ ...base, a: null, P: 365.25 }, 1);
  close(derived.a, 1, 1e-4);
  assert.ok(derived.s.includes('a'));
  assert.equal(resolvePlanet({ ...base, a: null, P: null }, 1), null);
  assert.equal(resolvePlanet({ ...base, a: null }, null), null);
  // Período derivado: no se propaga una fase con él.
  assert.ok(resolvePlanet({ ...base, P: null }, 1).s.includes('f'));
  // Periastro compartido por varios planetas = época de un ajuste dinámico: no se usa.
  assert.deepEqual(resolvePlanet({ ...base, tp: 2450602, f: { tr: false } }, 1, true).t, ['t0', 2455000]);
  assert.equal(resolvePlanet({ ...base, tp: 2450602, t0: null, f: { tr: false } }, 1, true).t, null);
  assert.deepEqual(resolvePlanet({ ...base, tp: 2450602, f: { tr: false } }, 1, false).t, ['tp', 2450602]);
});

test('Corregir una distancia conserva la dirección y ajusta la magnitud absoluta', () => {
  const star = { i: 7, n: null, x: 19.77081, y: 13.03962, z: -16.71056, d: 28.9855, m: 9.519, c: 1.456, sp: null, rgb: [255, 202, 160] };
  const moved = applyDistance(star, 36.6838, 'Gaia DR3');
  close(Math.hypot(moved.x, moved.y, moved.z), 36.6838, 1e-4);
  const cosine = (star.x * moved.x + star.y * moved.y + star.z * moved.z) / (Math.hypot(star.x, star.y, star.z) * Math.hypot(moved.x, moved.y, moved.z));
  close(cosine, 1, 1e-12, 'misma dirección');
  // La magnitud aparente no cambia: m − M = 5 log10(d / 10).
  close(moved.m + 5 * Math.log10(moved.d / 10), star.m + 5 * Math.log10(star.d / 10), 1e-3);
  assert.equal(moved.ds, 'Gaia DR3');
  assert.deepEqual([moved.c, moved.rgb, moved.i], [star.c, star.rgb, star.i]);
  const patched = applyPatches([star, { ...star, i: 8 }], { corrections: [{ i: 7, dNueva: 36.6838, fuente: 'Gaia DR3' }] });
  assert.equal(patched[0].d, 36.6838);
  assert.deepEqual(patched[1], { ...star, i: 8 });
});

test('El criterio de corrección exige paralaje precisa, RUWE bajo, G no saturada y enlace fiable', () => {
  const g = { plx: 20, plxE: 0.02, ruwe: 1.0, G: 9, bpRp: 1.0 };
  const mag = vFromGaia(9, 1.0);
  assert.equal(decideDistance({ dHoshi: 52, mag, g, via: 'hip', gq: { sep: 0.01, vecinos: 1 } }), null);
  assert.equal(decideDistance({ dHoshi: 80, mag, g, via: 'hip', gq: { sep: 0.01, vecinos: 1 } }).apply, true);
  for (const change of [{ g: { ...g, plxE: 3 } }, { g: { ...g, ruwe: 1.5 } }, { g: { ...g, G: 4.2 } }, { gq: { sep: 0.01, vecinos: 2 } }, { mag: mag + 2 },
    { via: 'posicion', gq: { val: 'mag' } }]) {
    assert.equal(decideDistance({ dHoshi: 80, mag, g, via: 'hip', gq: { sep: 0.01, vecinos: 1 }, ...change }).apply, false, JSON.stringify(change));
  }
});

test('Las anfitrionas añadidas usan un rango de ID sin colisiones y posiciones propagadas a J2000', () => {
  const stars = json('../data/processed/stars_15pc.json');
  const ids = stars.map(s => s.i);
  assert.equal(new Set(ids).size, ids.length, 'ID únicos');
  const added = stars.filter(s => s.dataOrigin === 'exoplanet-host');
  assert.ok(added.length > 3000);
  assert.ok(added.every(s => s.i > ADDED_HOST_ID_BASE && s.h && s.ds && [s.x, s.y, s.z, s.d, s.m].every(Number.isFinite)));
  assert.ok(stars.filter(s => s.dataOrigin !== 'exoplanet-host').every(s => s.i < ADDED_HOST_ID_BASE));
  assert.throws(() => applyPatches([{ i: ADDED_HOST_ID_BASE + 1, x: 1, y: 0, z: 0, d: 1, m: 5 }], { added: [{ i: ADDED_HOST_ID_BASE + 1, src: { d: 'paralaje Gaia DR3' } }] }));
  // TRAPPIST-1: 80,2 mas en Gaia DR3 → 12,47 pc, en Acuario.
  const trappist = added.find(s => s.h === 'TRAPPIST-1');
  close(trappist.d, 12.467, 0.01);
  const { raDeg, decDeg } = skyDirection([trappist.x, trappist.y, trappist.z]);
  close(raDeg, 346.6224, 0.002, 'RA J2000');
  close(decDeg, -5.0414, 0.002, 'Dec J2000');
  // 16 años de movimiento propio: 1″/año hacia el este en el ecuador son 16″ menos de RA en J2000.
  const [ra, dec] = propagateToJ2000(10, 0, 1000, -500);
  close(ra, 10 - 16 / 3600, 1e-9);
  close(dec, 8 / 3600, 1e-9);
  // Una microlente sin estrella catalogada no se añade.
  assert.equal(buildHost({ host: { h: 'OGLE-X', alias: [] }, system: { ra: 1, dec: 1, dNasa: 5000, v: 20, st: {}, p: [{ dm: 'Microlensing' }] }, gaia: null }).skip,
    'microlente sin estrella catalogada');
});

test('B−V desde la temperatura invierte la fórmula de Ballesteros', () => {
  for (const bv of [-0.2, 0, 0.656, 1.5, 2.7]) close(temperatureToBv(bvToTemperature(bv)), bv, 1e-3);
  assert.equal(temperatureToBv(100000), null);
  // Riello et al. (2021): para BP−RP = 0,82 (solar) G − V ≈ −0,15.
  close(vFromGaia(10, 0.82) - 10, 0.153, 0.01);
});

test('El JSON de planetas solo cita estrellas del catálogo y se une a ellas en su posición', () => {
  const data = json('../public/data/exoplanets.json'), stars = json('../data/processed/stars_15pc.json');
  const starsById = new Map(stars.map(s => [s.i, s]));
  assert.ok(data.systems.every(system => starsById.has(system.i)));
  assert.ok(data.systems.every(system => system.p.every(p => p.a > 0 && p.e >= 0 && p.e < 1 && Number.isFinite(p.inc) && Number.isFinite(p.w) && typeof p.s === 'string')));
  const systems = buildPlanetarySystems({ systems: data.systems.filter(s => ['TRAPPIST-1', 'GJ 876', 'HD 219134'].includes(s.h)) }, starsById);
  assert.equal(systems.length, 3);
  const trappist = systems.find(s => s.name === 'TRAPPIST-1');
  assert.equal(trappist.planets.length, 7);
  assert.deepEqual(trappist.position, [trappist.star.x, trappist.star.y, trappist.star.z]);
  for (const planet of trappist.planets) {
    close(planet.separationAu, planet.a, planet.a * 0.02, planet.n);
    // Radios físicos: del orden del terrestre, 4,3e-5 UA.
    close(planet.radiusPc * 206265 * 149597870.7, planet.r * 6378.1, 1e-6);
  }
  // GJ 876: el periastro común de la tabla es una época de ajuste; e no tiene fase y lo declara.
  const gj876 = systems.find(s => s.name === 'GJ 876');
  assert.ok(gj876.planets.find(p => p.n === 'GJ 876 e').s.includes('f'));
  assert.ok(gj876.planets.every(p => p.assumptions.length === p.s.length));
  assert.ok(Number.isFinite(EXOPLANET_EPOCH_JD));
});

test('La llegada a un sistema mira el plano orbital abierto y cada planeta con radio es un destino', () => {
  const data = json('../public/data/exoplanets.json'), stars = json('../data/processed/stars_15pc.json');
  const starsById = new Map(stars.map(s => [s.i, s]));
  const systems = buildPlanetarySystems({ systems: data.systems.filter(s => ['TRAPPIST-1', 'GJ 876', '51 Peg'].includes(s.h)) }, starsById);
  for (const system of systems) {
    const outer = system.planets.reduce((a, b) => b.apoapsisPc > a.apoapsisPc ? b : a);
    const normal = orbitNormal(outer, system.sky);
    close(Math.hypot(...system.viewDirection), 1, 1e-12);
    close(Math.acos(dot(system.viewDirection, normal)) * 180 / Math.PI, ARRIVAL_TILT_DEG, 1e-6, system.name);
    // La normal es perpendicular a la órbita dibujada.
    for (const E of [0.3, 2, 4.4]) close(dot(normal, planetOffsetAu(E, outer, system.sky)), 0, 1e-12);
    const view = bodyView({ kind: 'star', position: system.position, radiusKm: 1e5, viewDirection: system.viewDirection });
    assert.deepEqual(view.direction, system.viewDirection);
    for (const planet of system.planets.filter(p => p.r !== null)) {
      const body = planet.body, planetView = bodyView(body);
      assert.equal(body.kind, 'exoplanet');
      body.position.forEach((value, i) => close(value, system.position[i] + planet.offsetPc[i], 1e-15));
      close(planetView.distance, planet.radiusPc * PLANET_VIEW_RADII, 1e-20);
      // La cámara queda del lado opuesto a la estrella y por encima del plano orbital,
      // con la normal como vertical: la estrella se ve detrás, fuera del disco del planeta.
      const away = planet.offsetPc.map(v => v / Math.hypot(...planet.offsetPc));
      close(Math.hypot(...planetView.direction), 1, 1e-12);
      assert.ok(dot(planetView.direction, away) > 0.9, planet.n);
      close(Math.asin(dot(planetView.direction, planetView.up)) * 180 / Math.PI, PLANET_VIEW_ELEVATION_DEG, 1e-6, planet.n);
      const separation = Math.acos(dot(planetView.direction, away)) * 180 / Math.PI;
      assert.ok(separation > 12 && separation < 30, `${planet.n}: ${separation}`);
    }
  }
  // El giro termina antes que el acercamiento: a 30 veces la distancia final la cámara
  // ya está en la dirección de llegada.
  const system = systems[0], view = { ...bodyView({ kind: 'star', position: system.position, radiusKm: 1e5,
    companionViewDistance: system.framePc * 3.2, viewDirection: system.viewDirection }), journey: { start: [0, 0, 0], rotation: [0, 0, 0, 1] } };
  const camera = new PerspectiveCamera(), motion = beginJourney(camera, view, system.position);
  let seen = false;
  while (!advanceJourney(camera, motion, view, 50, 0.05)) {
    const offset = camera.position.clone().sub(motion.target);
    if (offset.length() > view.distance * 30) continue;
    seen = true;
    close(offset.normalize().dot(new Vector3(...system.viewDirection)), 1, 1e-9);
  }
  assert.ok(seen);
  // Los cuerpos sin dirección declarada conservan la llegada de siempre.
  assert.equal('direction' in bodyView({ kind: 'star', position: [1, 2, 3] }), false);
});
