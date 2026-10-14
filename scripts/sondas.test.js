import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { AU_TO_PC } from '../src/scene/scale.js';
import { PROBE_INFO, TAIL_START_FRACTION, buildProbeBodies, julianDay, probePositionAu, probeTailAu, probeTrailPc } from '../src/scene/probeTrajectories.js';

const data = JSON.parse(fs.readFileSync(new URL('../public/data/probes.json', import.meta.url), 'utf8'));
const probe = code => data.probes.find(item => item.code === code);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
// Referencias de JPL Horizons (centro del Sol, ICRF, UA), consultadas el 14/10/2026: la Tierra
// en el primer instante de cada sonda y cada planeta a mediodía UTC del día de su encuentro.
const EARTH_AT_START = { [-23]: [-0.9481, 0.266, 0.1153], [-24]: [-0.9595, -0.2613, -0.1133],
  [-32]: [0.8562, -0.4945, -0.2144], [-31]: [0.965, -0.2673, -0.1159] };
const FLYBYS = [[-23, 'Júpiter', '1973-12-04', [3.7932, -3.0346, -1.3933]], [-24, 'Júpiter', '1974-12-03', [4.912, -0.6497, -0.3982]],
  [-31, 'Júpiter', '1979-03-05', [-3.2231, 3.8265, 1.7189]], [-32, 'Júpiter', '1979-07-09', [-3.9344, 3.2696, 1.4975]],
  [-24, 'Saturno', '1979-09-01', [-9.145, 1.7713, 1.1245]], [-31, 'Saturno', '1980-11-12', [-9.5009, -0.485, 0.208]],
  [-32, 'Saturno', '1981-08-26', [-9.392, -1.9556, -0.4039]], [-32, 'Urano', '1986-01-24', [-3.669, -17.2097, -7.4853]],
  [-32, 'Neptuno', '1989-08-25', [6.0013, -27.3521, -11.3448]]];

test('Las cuatro sondas tienen trayectoria de Horizons desde el lanzamiento', () => {
  assert.deepEqual(data.probes.map(item => item.code).sort(), [-23, -24, -31, -32]);
  for (const item of data.probes) {
    assert.ok(PROBE_INFO[item.code]);
    // Empieza junto a la Tierra: a 1 UA del Sol y a menos de 0,01 UA de la Tierra.
    const start = probePositionAu(item, item.startJd);
    const earth = EARTH_AT_START[item.code];
    assert.ok(distance(start, earth) < 0.01, `${item.code}: ${distance(start, earth)} UA de la Tierra`);
  }
});

// Posiciones de Horizons del 13/10/2026 (distancia en UA y dirección ICRF), consultadas aparte.
const VOYAGER_2026 = [[-31, 'Voyager 1', 172, [-32.17736797249886, -165.0258113752864, 36.42564436655562]],
  [-32, 'Voyager 2', 144, [39.91940429842525, -61.107913058101, -124.3501977118814]]];

test('Las Voyager coinciden con las posiciones de Horizons del 13/10/2026', () => {
  const jd = julianDay(new Date(Date.UTC(2026, 9, 13)));
  for (const [code, name, au, direction] of VOYAGER_2026) {
    const reference = { au, direction };
    const position = probePositionAu(probe(code), jd);
    assert.ok(Math.abs(Math.hypot(...position) - reference.au) < 1, name);
    const unit = reference.direction.map(value => value / Math.hypot(...reference.direction));
    const cos = position.reduce((sum, value, i) => sum + value * unit[i], 0) / Math.hypot(...position);
    assert.ok(cos > Math.cos(0.1 * Math.PI / 180), `${name}: ${Math.acos(cos) * 180 / Math.PI}°`);
  }
});

test('Las trayectorias pasan por los planetas en las fechas de sus encuentros', () => {
  // Fechas de máximo acercamiento publicadas por la NASA; a escala heliocéntrica basta con 0,05 UA.
  for (const [code, planet, day, reference] of FLYBYS) {
    const gap = distance(probePositionAu(probe(code), julianDay(new Date(`${day}T12:00:00Z`))), reference);
    assert.ok(gap < 0.05, `${PROBE_INFO[code].name} en ${planet}: ${gap.toFixed(3)} UA`);
  }
});

test('La estela termina en la posición de la fecha de la escena', () => {
  const date = new Date(Date.UTC(2026, 9, 14, 15));
  const [body] = buildProbeBodies([probe(-31)], date);
  const trail = probeTrailPc(probe(-31), julianDay(date));
  assert.deepEqual([...trail.slice(-3)].map(value => Math.round(value / AU_TO_PC * 1e3)), body.positionAu.map(value => Math.round(value * 1e3)));
  assert.ok(Math.abs(trail[0] / AU_TO_PC - probe(-31).xyz[0]) < 1e-6);
});

test('La cola de cometa sigue la trayectoria y no entra en el sistema solar', () => {
  const jd = julianDay(new Date(Date.UTC(2026, 9, 14)));
  for (const item of data.probes) {
    const head = probePositionAu(item, jd), tail = probeTailAu(item, jd);
    const ratio = Math.hypot(...tail) / Math.hypot(...head);
    assert.ok(ratio <= TAIL_START_FRACTION && ratio > TAIL_START_FRACTION - 0.05, `${item.code}: ${ratio}`);
    assert.ok(Math.hypot(...tail) > 50, `${item.code}: la cola empieza a ${Math.hypot(...tail)} UA`);
  }
});
