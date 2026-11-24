import test from 'node:test';
import assert from 'node:assert/strict';
import { generarOortBola } from '../src/scene/oort.js';
import { valoresRuido3D } from '../src/scene/galaxiaRuido.js';
import { alabeo, anillosPlanta, brilloPolo, camaraGalactica, crearMapaCpu, integralTramo, integrarRayo, leerAnillo, perfilExp, pesoVolumen } from '../src/scene/galaxiaModelo.js';
import { GALAXY_CENTER, GALACTIC_X, GALACTIC_Z } from '../src/scene/galaxy.js';

test('la nube de Oort va de 2.000 a 100.000 UA, como la ficha', () => {
  const r = [...generarOortBola({ n: 5000 }).radioUA];
  assert.ok(Math.max(...r) <= 100000 * 1.0001 && Math.min(...r) >= 2000 * 0.9999, `${Math.min(...r)} ${Math.max(...r)}`);
});

test('el ruido 3D de los grumos tiene media 0,5 y desviación 1/6', () => {
  const v = valoresRuido3D(16);
  const x = [...v].map(b => (b / 255 - 0.5) * 6), media = x.reduce((a, b) => a + b, 0) / x.length;
  const sigma = Math.sqrt(x.reduce((a, b) => a + (b - media) ** 2, 0) / x.length);
  assert.ok(Math.abs(media) < 0.05 && Math.abs(sigma - 1) < 0.1, `${media} ${sigma}`);
});

test('integral exacta de un tramo del perfil exponencial', () => {
  // Tramo vertical de −∞ a +∞ (aprox.): integra 1.
  assert.ok(Math.abs(integralTramo(-5, 5, 10, 0.3) - 1) < 1e-6);
  // Tramo casi horizontal: el punto medio.
  assert.ok(Math.abs(integralTramo(0.1, 0.1, 2, 0.3) - perfilExp(0.1, 0.3) * 2) < 1e-12);
});

test('desde dentro del disco, el cielo a 20° de latitud es más tenue que la banda', () => {
  const mapa = () => ({ E: [0.1, 0.1, 0.1], tau: 0.16, fJoven: 0.2 });
  const cam = [-8.12, 0, 0.02];
  const banda = integrarRayo(cam, [1, 0, 0], mapa).C[1];
  assert.ok(brilloPolo(cam, mapa) < 0.5 * banda);
});

// Punto galactocéntrico (kpc) a la altura z' sobre el plano medio alabeado.
const enPlanoMedio = (x, y, zp) => { const R = Math.hypot(x, y), k = Math.min(1, 16 / R); return [x, y, alabeo(x * k, y * k) + zp]; };
const cerca = (a, b, e = 1e-9) => Math.abs(a - b) <= e;

test('cruce de la galaxia: el volumen pesa 1 en el plano a 8 kpc y 0 a 1,5 kpc de altura o a 20 kpc del centro', () => {
  assert.ok(cerca(pesoVolumen(enPlanoMedio(-8, 0, 0)).W, 1));
  assert.ok(cerca(pesoVolumen(enPlanoMedio(-8, 0, 1.5)).W, 0));
  assert.ok(cerca(pesoVolumen(enPlanoMedio(-8, 0, -1.5)).W, 0));
  assert.ok(cerca(pesoVolumen(enPlanoMedio(-20, 0, 0)).W, 0));
  assert.ok(cerca(pesoVolumen(enPlanoMedio(-8, 0, 0.3)).sinBrazos, 0));
  assert.ok(cerca(pesoVolumen(enPlanoMedio(-8, 0, 0.6)).sinBrazos, 1));
});

test('cruce de la galaxia: el peso es simétrico en altura y no crece al subir ni al alejarse', () => {
  for (const [x, y] of [[-8, 0], [3, 9], [-14, -6], [17, 2]]) {
    let previo = Infinity;
    for (let zp = 0; zp <= 2; zp += 0.05) {
      const arriba = pesoVolumen(enPlanoMedio(x, y, zp)).W, abajo = pesoVolumen(enPlanoMedio(x, y, -zp)).W;
      assert.ok(cerca(arriba, abajo, 1e-12) && arriba <= previo + 1e-12, `${x},${y},${zp}`);
      previo = arriba;
    }
  }
  let previo = Infinity;
  for (let R = 0; R <= 24; R += 0.25) { const w = pesoVolumen(enPlanoMedio(-R, 0, 0)).W; assert.ok(w <= previo + 1e-12, `${R}`); previo = w; }
});

test('cruce de la galaxia: donde la imagen pesa más de 0,05, el volumen ya no tiene brazos', () => {
  let casos = 0;
  for (let R = 0.5; R <= 24; R += 0.1) for (let zp = 0; zp <= 2; zp += 0.01) {
    const p = pesoVolumen(enPlanoMedio(-R, 0.3 * R, zp));
    if (1 - p.W > 0.05) { casos++; assert.ok(p.sinBrazos > 0.95, `R=${R} z'=${zp}: W=${p.W} sinBrazos=${p.sinBrazos}`); }
  }
  assert.ok(casos > 1000);
});

test('cruce de la galaxia: el peso es el mismo con el origen en el Sol o en otra estrella', () => {
  const punto = [GALAXY_CENTER[0] - 5000 * GALACTIC_X[0] + 900 * GALACTIC_Z[0], GALAXY_CENTER[1] - 5000 * GALACTIC_X[1] + 900 * GALACTIC_Z[1], GALAXY_CENTER[2] - 5000 * GALACTIC_X[2] + 900 * GALACTIC_Z[2]];
  for (const origen of [[0, 0, 0], [3.1, -7.4, 12.2], [-1234.5, 820.25, 77.75]]) {
    const pos = { x: punto[0] - origen[0], y: punto[1] - origen[1], z: punto[2] - origen[2] };
    const a = pesoVolumen(camaraGalactica(pos, origen)), b = pesoVolumen(camaraGalactica({ x: punto[0], y: punto[1], z: punto[2] }, [0, 0, 0]));
    assert.ok(cerca(a.W, b.W, 1e-9) && cerca(a.sinBrazos, b.sinBrazos, 1e-9));
  }
});

test('cruce de la galaxia: los anillos guardan el promedio de la planta a 4, 8 y 12 kpc (±1 %)', () => {
  // Planta sintética de 256² con brazos y polvo variables.
  const n = 256, emision = new Uint8ClampedArray(n * n * 4), polvo = new Uint8ClampedArray(n * n * 4);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = 4 * (j * n + i), a = Math.atan2(j - n / 2, i - n / 2), r = Math.hypot(j - n / 2, i - n / 2);
    const brazo = 0.5 + 0.5 * Math.sin(2 * a + r / 9);
    emision.set([40 + 180 * brazo, 30 + 150 * brazo, 20 + 120 * brazo, 255], k);
    polvo.set([60 + 150 * (1 - brazo), 40 + 200 * brazo, 255 * brazo, 255], k);
  }
  const anillos = anillosPlanta({ emision, polvo, n });
  const mapa = crearMapaCpu({ emision, polvo, n });
  for (const R of [4, 8, 12]) {
    const s = { E: [0, 0, 0], tau: 0, hPolvo: 0, fJoven: 0 }, m = 4096;
    for (let k = 0; k < m; k++) {
      const th = (k + 0.25) / m * 2 * Math.PI, v = mapa(R * Math.cos(th), R * Math.sin(th));
      for (let c = 0; c < 3; c++) s.E[c] += v.E[c] / m;
      s.tau += v.tau / m; s.hPolvo += v.hPolvo / m; s.fJoven += v.fJoven / m;
    }
    const a = leerAnillo(anillos, R);
    // La planta de la CPU ya lleva el borde (1 dentro de R < 17 kpc): a 4–12 kpc se compara directo.
    for (const [x, y] of [[a.E[0], s.E[0]], [a.E[1], s.E[1]], [a.E[2], s.E[2]], [a.tau, s.tau], [a.hPolvo, s.hPolvo], [a.fJoven, s.fJoven]])
      assert.ok(Math.abs(x / y - 1) < 0.01, `R=${R}: ${x} ${y}`);
  }
  // Con sinBrazos = 1 la planta de la CPU es el anillo.
  const liso = crearMapaCpu({ emision, polvo, n, anillos, sinBrazos: 1 });
  const p = liso(0, 8), q = liso(8, 0);
  assert.ok(Math.abs(p.tau / q.tau - 1) < 0.01 && Math.abs(p.E[1] / q.E[1] - 1) < 0.01);
});
