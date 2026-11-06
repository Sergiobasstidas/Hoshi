import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { AU_KM, AU_TO_PC, KM_TO_PC } from '../src/scene/scale.js';
import { planetOrbit } from '../src/scene/solarEphemeris.js';
import { FLYBY_PLANETS, closestApproach, composeRoute, flybyArcPc, flybyBody, flybySamples } from '../src/scene/probeFlybys.js';
import { LIGHT_DAY_AU, PROBE_INFO, clearRouteMark, markRouteClick, markRouteMissed, probeLit, TAIL_START_FRACTION, buildProbeBodies, lightDaysText, julianDay, probePositionAu, probeSamples, probeTailAu, probeTrailPc } from '../src/scene/probeTrajectories.js';

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

// Máximo acercamiento según Horizons (vectores centrados en el planeta, cada 10 minutos),
// consultado el 05/11/2026 (scripts/probes/fetch_flybys.mjs).
const CLOSEST = [[-23, '1973-12-04T02:30Z'], [-24, '1974-12-03T05:19Z'], [-24, '1979-09-01T16:30Z'],
  [-31, '1979-03-05T12:09Z'], [-31, '1980-11-12T23:50Z'], [-32, '1979-07-09T22:30Z'],
  [-32, '1981-08-26T03:20Z'], [-32, '1986-01-24T18:00Z'], [-32, '1989-08-25T04:00Z']];

test('Cada paso por un planeta tiene un tramo denso de Horizons alrededor del máximo acercamiento', () => {
  for (const [code, when] of CLOSEST) {
    const jd = julianDay(new Date(when));
    const samples = probeSamples(probe(code));
    // Muestras cada 10 minutos en ± 1 día y cada hora en ± 6 días del encuentro.
    const near = [...samples.jd].filter(t => Math.abs(t - jd) <= 1);
    const wide = [...samples.jd].filter(t => Math.abs(t - jd) <= 6);
    assert.ok(near.length >= 280, `${PROBE_INFO[code].name} ${when}: ${near.length} muestras en ± 1 día`);
    assert.ok(wide.length >= near.length + 230, `${PROBE_INFO[code].name} ${when}: ${wide.length} muestras en ± 6 días`);
  }
});

test('Las muestras van en orden y el tramo denso no deja saltos', () => {
  for (const item of data.probes) {
    const { jd, xyz } = probeSamples(item);
    for (let i = 1; i < jd.length; i++) {
      assert.ok(jd[i] > jd[i - 1], `${item.code}: tiempo repetido en ${jd[i]}`);
      // Ninguna sonda recorre más de 0,25 UA entre dos muestras (8 días a menos de 55 km/s).
      const step = Math.hypot(xyz[i * 3] - xyz[i * 3 - 3], xyz[i * 3 + 1] - xyz[i * 3 - 2], xyz[i * 3 + 2] - xyz[i * 3 - 1]);
      assert.ok(step < 0.25, `${item.code}: ${step} UA en ${jd[i]}`);
    }
  }
});

test('La etiqueta da la distancia a la Tierra en días luz', () => {
  assert.equal(Math.round(LIGHT_DAY_AU * 1e4) / 1e4, 173.1446);
  assert.equal(lightDaysText(LIGHT_DAY_AU * 0.9993), '0,999 días luz');
  assert.equal(lightDaysText(LIGHT_DAY_AU), '1 día luz');
  assert.equal(lightDaysText(LIGHT_DAY_AU * 1.0004), '1 día luz');
  assert.equal(lightDaysText(LIGHT_DAY_AU * 1.0006), '1,001 días luz');
  // Horizons, centro en la Tierra, 2026-11-18 00:00 TDB: Voyager 1 a 173,1383 UA.
  const [body] = buildProbeBodies([probe(-31)], new Date(Date.UTC(2026, 10, 18)));
  assert.ok(Math.abs(body.earthAu - 173.1383) < 0.002, `${body.earthAu} UA`);
  assert.equal(lightDaysText(body.earthAu), '1 día luz');
});

// Curvas con centro en el planeta (public/data/probe-flybys.json, scripts/probes/fetch_flyby_curves.mjs).
const flybyData = JSON.parse(fs.readFileSync(new URL('../public/data/probe-flybys.json', import.meta.url), 'utf8'));
// Distancia mínima centro a centro publicada por la NASA, en km.
const CLOSEST_KM = [[-23, 'jupiter', 200000], [-24, 'jupiter', 114000], [-24, 'saturno', 81000], [-31, 'jupiter', 349000],
  [-31, 'saturno', 185000], [-32, 'jupiter', 722000], [-32, 'saturno', 161000], [-32, 'urano', 107000], [-32, 'neptuno', 29000]];

test('Cada sobrevuelo pasa a la distancia publicada del centro del planeta', () => {
  assert.equal(flybyData.flybys.length, CLOSEST_KM.length);
  for (const [code, planet, km] of CLOSEST_KM) {
    const flyby = flybyData.flybys.find(item => item.code === code && item.planet === planet);
    const closest = closestApproach(flyby);
    assert.ok(Math.abs(closest.km - km) / km < 0.03, `${PROBE_INFO[code].name} en ${planet}: ${closest.km.toFixed(0)} km`);
    assert.ok(Math.abs(closest.km - flyby.closestKm) < 20, `${code} ${planet}: cuantización`);
  }
});

test('El máximo acercamiento cae en la fecha publicada del sobrevuelo', () => {
  for (const [code, when] of CLOSEST) {
    const jd = julianDay(new Date(when));
    const flyby = flybyData.flybys.find(item => item.code === code && Math.abs(item.closestJd - jd) < 1);
    assert.ok(flyby, `${PROBE_INFO[code].name} ${when}`);
    assert.ok(Math.abs(closestApproach(flyby).jd - jd) < 10 / 1440, `${PROBE_INFO[code].name} ${when}`);
  }
  const days = flybyData.flybys.map(flyby => `${flyby.code} ${flybyBody(flyby, { name: FLYBY_PLANETS[flyby.planet], radiusKm: 1 }, [0, 0, 0], 0).name} `
    + new Date((flyby.closestJd - 2440587.5) * 86400000).toISOString().slice(0, 10));
  for (const [code, planet, day] of FLYBYS) assert.ok(days.some(text => text.startsWith(`${code} ${planet}`) && text.endsWith(day)), `${code} ${planet} ${day}`);
});

test('El planeta de entonces coincide con la ruta heliocéntrica menos la curva', () => {
  for (const flyby of flybyData.flybys) {
    const { jd, km } = flybySamples(flyby);
    const i = jd.findIndex(t => t >= flyby.closestJd);
    const helio = probePositionAu(probe(flyby.code), jd[i]);
    const planet = [0, 1, 2].map(axis => helio[axis] - km[i * 3 + axis] / AU_KM);
    // Es la posición de Horizons del planeta; la trayectoria de la sonda se calculó con las efemérides
    // de entonces: en Urano y Neptuno difieren hasta 14.000 km (≈ 1e-4 UA).
    const limit = ['urano', 'neptuno'].includes(flyby.planet) ? 1e-4 : 2e-5;
    assert.ok(distance(planet, flyby.planetAu) < limit, `${flyby.code} ${flyby.planet}: ${distance(planet, flyby.planetAu)} UA`);
  }
});

test('La ruta es una sola línea heliocéntrica que pasa por cada muestra de Horizons y suma el detalle de los sobrevuelos', () => {
  for (const code of [-23, -24, -31, -32]) {
    const [body] = buildProbeBodies([probe(code)], new Date(Date.UTC(2026, 9, 14)));
    const own = flybyData.flybys.filter(item => item.code === code);
    const { points, ghosts } = composeRoute(body.trail, probeSamples(body.data).jd, body.data, own);
    assert.equal(ghosts.length, own.length);
    // Empieza en el lanzamiento y termina en la posición de la fecha.
    assert.deepEqual([...points.slice(0, 3)], [...body.trail.slice(0, 3)]);
    assert.deepEqual([...points.slice(-3)], [...body.trail.slice(-3)]);
    // Continua: ningún salto mayor que el de 8 días de crucero (0,25 UA).
    for (let i = 3; i < points.length; i += 3) {
      const step = Math.hypot(points[i] - points[i - 3], points[i + 1] - points[i - 2], points[i + 2] - points[i - 1]) / AU_TO_PC;
      assert.ok(step < 0.25, `${code}: ${step} UA`);
    }
    // Más muestras que la ruta sola (el detalle de cada minuto junto a los planetas).
    assert.ok(points.length > body.trail.length + own.length * 1000 * 3, `${code}`);
    // Pasa por cada muestra heliocéntrica densa de Horizons (a menos de 1 km).
    const { jd, xyz } = probeSamples(body.data);
    for (const ghost of ghosts) {
      const { jd: closest } = closestApproach(ghost.flyby);
      for (let i = 0; i < jd.length; i++) {
        if (Math.abs(jd[i] - closest) > 5 || i % 7) continue;
        const target = [0, 1, 2].map(a => xyz[i * 3 + a] * AU_TO_PC);
        let best = Infinity;
        for (let k = 0; k < points.length; k += 3) best = Math.min(best, Math.hypot(points[k] - target[0], points[k + 1] - target[1], points[k + 2] - target[2]));
        assert.ok(best / KM_TO_PC < 1, `${code} ${ghost.flyby.planet}: ${(best / KM_TO_PC).toFixed(1)} km`);
      }
      // La sonda en el máximo acercamiento queda a la distancia mínima del planeta de entonces.
      const gap = Math.hypot(...ghost.probePc.map((v, a) => v - ghost.planetPc[a])) / KM_TO_PC;
      assert.ok(Math.abs(gap - ghost.flyby.closestKm) < 20, `${code} ${ghost.flyby.planet}: ${gap.toFixed(0)} km`);
      // El planeta de entonces queda a menos de 15.000 km del de Horizons (efemérides de entonces y de ahora).
      assert.ok(distance(ghost.planetPc.map(v => v / AU_TO_PC), ghost.flyby.planetAu) * AU_KM < 15000, `${code} ${ghost.flyby.planet}`);
    }
  }
});

test('El arco de la órbita real pasa por el planeta de entonces y lo recorre en su sentido', () => {
  for (const flyby of flybyData.flybys) {
    const arc = flybyArcPc(flyby);
    assert.equal(arc.length / 3, 121, `${flyby.code} ${flyby.planet}`);
    assert.deepEqual([...arc.slice(flyby.arc.center * 3, flyby.arc.center * 3 + 3)], [0, 0, 0]);
    // Un día de órbita: Júpiter recorre ≈ 1,1 millones de km; Neptuno, ≈ 470.000 km.
    const day = Math.hypot(...[0, 1, 2].map(k => arc[(flyby.arc.center + 1) * 3 + k])) / AU_TO_PC * AU_KM;
    const expected = { jupiter: 1.13e6, saturno: 0.83e6, urano: 0.59e6, neptuno: 0.47e6 }[flyby.planet];
    assert.ok(Math.abs(day - expected) / expected < 0.15, `${flyby.code} ${flyby.planet}: ${day.toFixed(0)} km/día`);
    // El planeta de entonces de la sonda y el de Horizons difieren a lo más en 15.000 km.
    const planet = fs.readFileSync(new URL(`../data/probes/sobrevuelos/${flyby.code}-${flyby.planet}.csv`, import.meta.url), 'utf8')
      .match(/instante \(centro del Sol, ICRF, UA\): ([^\n]+)/)[1].split(',').map(Number);
    assert.ok(distance(planet, flyby.planetAu) * AU_KM < 15000, `${flyby.code} ${flyby.planet}`);
  }
});

test('Las sondas se ofrecen como cuerpos con la antena hacia la Tierra', () => {
  const bodies = buildProbeBodies(data.probes, new Date(Date.UTC(2026, 10, 5)));
  for (const body of bodies) {
    assert.equal(body.kind, 'probe');
    assert.ok(Math.abs(Math.hypot(...body.towardEarth) - 1) < 1e-9);
    // Vista desde 170 UA, la Tierra queda casi en la dirección del Sol.
    const sunward = body.positionAu.map(value => -value / Math.hypot(...body.positionAu));
    assert.ok(body.towardEarth.reduce((sum, value, i) => sum + value * sunward[i], 0) > 0.999, body.name);
    assert.ok(body.radiusKm > 0.001 && body.radiusKm < 0.01);
  }
});

test('Un clic marca una ruta, otro la cambia y un clic en el vacío la quita', () => {
  markRouteClick(-31);
  assert.ok(probeLit(-31) && !probeLit(-32));
  // Clic en la ruta de la Voyager 2: el aviso de «sin acierto» de la Voyager 1 puede llegar antes o después.
  markRouteMissed(-31); markRouteClick(-32);
  assert.ok(probeLit(-32) && !probeLit(-31));
  markRouteClick(-23); markRouteMissed(-32);
  assert.ok(probeLit(-23) && !probeLit(-32));
  // Clic en el vacío (o Esc): todas las rutas reciben el aviso y la marca se va.
  for (const code of [-23, -24, -31, -32]) markRouteMissed(code);
  assert.ok(![-23, -24, -31, -32].some(probeLit));
  // Ir a un cuerpo (nombre, buscador, etapa) quita la marca.
  markRouteClick(-24); clearRouteMark();
  assert.ok(!probeLit(-24));
});

test('Urano 1986 y Neptuno 1989 caen sobre la órbita de hoy (trayectoria real de un período)', () => {
  const date = new Date(Date.UTC(2026, 10, 5));
  for (const flyby of flybyData.flybys.filter(item => ['urano', 'neptuno'].includes(item.planet))) {
    const orbit = planetOrbit(FLYBY_PLANETS[flyby.planet], date);
    let best = Infinity;
    for (let i = 0; i < orbit.length / 3 - 1; i++) {
      const a = [0, 1, 2].map(k => orbit[i * 3 + k] / AU_TO_PC), b = [0, 1, 2].map(k => orbit[i * 3 + 3 + k] / AU_TO_PC);
      const ab = a.map((v, k) => b[k] - v), ap = a.map((v, k) => flyby.planetAu[k] - v);
      const t = Math.max(0, Math.min(1, ap.reduce((sum, v, k) => sum + v * ab[k], 0) / ab.reduce((sum, v) => sum + v * v, 0)));
      best = Math.min(best, Math.hypot(...ap.map((v, k) => v - t * ab[k])) * AU_KM);
    }
    // Ajuste de Horizons (≈ 200 km) más el redondeo de 32 bits de la línea (≈ 600 km a 30 UA).
    assert.ok(best < 1500, `${flyby.planet}: ${best.toFixed(0)} km`);
  }
});

// Etapas de las sondas (public/data/probe-stages.json, scripts/probes/build_probe_stages.js).
const stages = JSON.parse(fs.readFileSync(new URL('../public/data/probe-stages.json', import.meta.url), 'utf8'));
const stagesOf = name => stages.probes.find(item => item.name === name).stages;

test('Las etapas tienen lanzamiento, sobrevuelos en orden, heliopausa publicada y hoy', () => {
  assert.deepEqual(stages.probes.map(item => item.name), ['Voyager 1', 'Voyager 2', 'Pioneer 10', 'Pioneer 11']);
  assert.deepEqual(stagesOf('Voyager 2').filter(stage => stage.kind === 'sobrevuelo').map(stage => stage.planet), ['Júpiter', 'Saturno', 'Urano', 'Neptuno']);
  for (const probe of stages.probes) {
    assert.equal(probe.stages[0].kind, 'lanzamiento');
    assert.equal(probe.stages.at(-1).kind, 'hoy');
    const flybys = probe.stages.filter(stage => stage.kind === 'sobrevuelo');
    for (let i = 1; i < flybys.length; i++) assert.ok(flybys[i].closestJd > flybys[i - 1].closestJd);
  }
  // Valores publicados (Burlaga et al. 2019): Voyager 1 a 121,6 UA y Voyager 2 a 119,0 UA.
  assert.deepEqual(stagesOf('Voyager 1').find(stage => stage.kind === 'heliopausa'), { kind: 'heliopausa', date: '2012-08-25', au: 121.6, source: 'https://doi.org/10.1038/s41550-019-0920-y' });
  assert.equal(stagesOf('Voyager 2').find(stage => stage.kind === 'heliopausa').au, 119);
  assert.ok(!stagesOf('Pioneer 10').some(stage => stage.kind === 'heliopausa'));
});

test('Las cifras clave de los sobrevuelos coinciden con las publicadas', () => {
  const flyby = (name, planet) => stagesOf(name).find(stage => stage.planet === planet);
  // Máximo acercamiento a las fechas y distancias de la NASA.
  assert.equal(flyby('Voyager 2', 'Neptuno').utc.slice(0, 10), '1989-08-25');
  assert.ok(Math.abs(flyby('Voyager 2', 'Neptuno').closestKm - 29000) < 600);
  assert.equal(flyby('Voyager 1', 'Júpiter').utc.slice(0, 10), '1979-03-05');
  // Júpiter le dio a cada sonda más de 7 km/s respecto del Sol; en Neptuno la Voyager 2, desviada al
  // sur, perdió rapidez.
  for (const name of ['Voyager 1', 'Voyager 2', 'Pioneer 10', 'Pioneer 11']) assert.ok(flyby(name, 'Júpiter').gain > 7, name);
  assert.ok(flyby('Voyager 2', 'Neptuno').gain < 0);
  for (const probe of stages.probes) for (const stage of probe.stages.filter(item => item.kind === 'sobrevuelo')) {
    // Coherencia: ganancia = después − antes; respecto del planeta, más rápida en el máximo acercamiento.
    assert.ok(Math.abs(stage.sunSpeedAfter - stage.sunSpeedBefore - stage.gain) < 0.011, `${probe.name} ${stage.planet}`);
    assert.ok(stage.planetSpeed > stage.approachSpeed && stage.deflectionDeg > 10 && stage.deflectionDeg < 180, `${probe.name} ${stage.planet}`);
  }
});

test('Hoy las cuatro sondas superan la rapidez de escape del Sol', () => {
  for (const probe of stages.probes) {
    const today = probe.stages.at(-1);
    assert.ok(today.sunSpeed > 2.5 * today.escapeSpeed, probe.name);
    assert.equal(probe.series.speed.length, probe.series.au.length);
    // La serie empieza junto a la Tierra (≈ 1 UA) y termina en la distancia de hoy.
    assert.ok(Math.abs(probe.series.au[0] - 1) < 0.02 && Math.abs(probe.series.au.at(-1) - today.au) < 0.5, probe.name);
  }
  // Rapidez de escape: 42,1 km/s a 1 UA.
  const oneAu = stages.escape.find(([au]) => Math.abs(au - 1) < 0.06);
  assert.ok(Math.abs(oneAu[1] - 42.1 * Math.sqrt(1 / oneAu[0])) < 0.1);
});

test('La línea de tiempo ordena las etapas, comprime el crucero y tiene texto para cada una', async () => {
  const { stageJd, stageText, timeAxis } = await import('../src/scene/probeStages.js');
  for (const probe of stages.probes) {
    const axis = timeAxis(probe.stages);
    assert.equal(axis.positions[0], 0);
    assert.ok(Math.abs(axis.positions.at(-1) - 1) < 1e-9);
    for (let i = 1; i < axis.positions.length; i++) assert.ok(axis.positions[i] > axis.positions[i - 1], `${probe.name} ${i}`);
    // La serie de rapidez cae dentro del eje y avanza con él.
    const { startJd, stepDays, speed } = probe.series;
    assert.ok(axis.at(startJd + stepDays * (speed.length - 1)) <= 1 && axis.at(startJd + stepDays) > 0);
    for (const stage of probe.stages) assert.ok(stageText(probe.code, stage).length > 40, `${probe.name}: ${stage.kind} ${stage.planet ?? ''}`);
    assert.ok(Number.isFinite(stageJd(probe.stages[0])));
    // `jdAt` deshace `at`: el cursor de la línea marca la fecha continua, sin saltar de muestra en muestra.
    for (const jd of [stageJd(probe.stages[0]) + 100, startJd + stepDays * 777.3, stageJd(probe.stages.at(-1)) - 3]) {
      assert.ok(Math.abs(axis.jdAt(axis.at(jd)) - jd) < 1e-4, `${probe.name} ${jd}`);
    }
    assert.ok(Math.abs(axis.jdAt(1) - stageJd(probe.stages.at(-1))) < 1e-6);
  }
  // Voyager 2: el tramo de 1977–1989 ocupa más de la mitad del eje, y el crucero lleva un corte.
  const voyager2 = stages.probes.find(item => item.name === 'Voyager 2');
  const axis = timeAxis(voyager2.stages);
  assert.ok(axis.positions[4] > 0.4 && axis.breaks.length >= 1);
});

// Muestras de Horizons con centro en el planeta tomadas aparte (scripts/probes/fetch_flyby_control.mjs).
const flybyControl = JSON.parse(fs.readFileSync(new URL('./probes/control_sobrevuelos.json', import.meta.url), 'utf8')).flybys;

test('Las curvas de los sobrevuelos coinciden punto a punto con Horizons centrado en el planeta', () => {
  for (const control of flybyControl) {
    const flyby = flybyData.flybys.find(item => item.code === control.code && item.planet === control.planet);
    const { jd, km } = flybySamples(flyby);
    for (const [t, ...reference] of control.samples) {
      // Interpolación lineal entre las muestras (cada 2 horas a más de ± 3 días).
      const after = jd.findIndex(value => value >= t);
      const i = after < 0 ? jd.length - 2 : Math.max(0, after - 1);
      const f = Math.min(1, Math.max(0, (t - jd[i]) / (jd[i + 1] - jd[i])));
      const point = [0, 1, 2].map(a => km[i * 3 + a] * (1 - f) + km[(i + 1) * 3 + a] * f);
      const gap = Math.hypot(...point.map((v, a) => v - reference[a]));
      // Cuantización de 10 km y la cuerda de 2 horas (≈ 70 km a 10 km/s); en ± 30 días la curva puede
      // empezar unos minutos después (≈ 10.000 km a 15 km/s).
      assert.ok(gap < (Math.abs(t - flyby.closestJd) > 29 ? 15000 : 150), `${control.code} ${control.planet} ${(t - flyby.closestJd).toFixed(0)} d: ${gap.toFixed(0)} km`);
    }
  }
});

test('Los brazos de cada curva de sobrevuelo son casi rectos y abiertos (hipérbola, sin vueltas)', () => {
  for (const flyby of flybyData.flybys) {
    const { jd, km } = flybySamples(flyby);
    const span = jd.at(-1) - jd[0];
    const direction = (a, b) => { const v = [0, 1, 2].map(k => km[b * 3 + k] - km[a * 3 + k]); const l = Math.hypot(...v); return v.map(x => x / l); };
    const index = t => jd.findIndex(value => value >= t);
    for (const [from, to] of [[jd[0], jd[0] + span * 0.2], [jd.at(-1) - span * 0.2, jd.at(-1)]]) {
      // El 20 % exterior de cada brazo: el rumbo cambia menos de 3° de un extremo al otro.
      const a = index(from), m = index((from + to) / 2), b = Math.min(index(to), jd.length - 1);
      const d1 = direction(a, m), d2 = direction(m, b);
      const angle = Math.acos(Math.min(1, d1.reduce((sum, v, k) => sum + v * d2[k], 0))) * 180 / Math.PI;
      assert.ok(angle < 3, `${flyby.code} ${flyby.planet}: ${angle.toFixed(2)}°`);
    }
    // Los extremos quedan lejos (más de 10 millones de km) y alejándose: no hay vuelta atrás (salvo el
    // redondeo de 10 km).
    const r = i => Math.hypot(km[i * 3], km[i * 3 + 1], km[i * 3 + 2]);
    assert.ok(r(0) > 1e7 && r(jd.length - 1) > 1e7, `${flyby.code} ${flyby.planet}`);
    let closest = 0;
    for (let i = 1; i < jd.length; i++) if (r(i) < r(closest)) closest = i;
    for (let i = closest + 1; i < jd.length; i++) assert.ok(r(i) >= r(i - 1) - 15, `${flyby.code} ${flyby.planet}: sale`);
    for (let i = closest - 1; i > 0; i--) assert.ok(r(i) >= r(i + 1) - 15, `${flyby.code} ${flyby.planet}: llega`);
  }
});
