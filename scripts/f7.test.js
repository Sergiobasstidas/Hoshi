import test from 'node:test';
import assert from 'node:assert/strict';
import { generarOortBola, generarOortEspiral } from '../src/scene/oort.js';
import { valoresRuido3D } from '../src/scene/galaxiaRuido.js';
import { brilloPolo, integralTramo, integrarRayo, perfilExp } from '../src/scene/galaxiaModelo.js';

test('las nubes de Oort de F-07 llegan hasta 100.000 UA, como la ficha', () => {
  for (const nube of [generarOortEspiral({ n: 5000 }), generarOortBola({ n: 5000 })]) {
    const r = [...nube.radioUA];
    assert.ok(Math.max(...r) <= 100000 * 1.0001, `${Math.max(...r)}`);
    // Las órbitas muy excéntricas de la espiral pasan a veces más cerca del Sol (perihelio): pocas.
    assert.ok(r.filter(x => x < 1000).length < 0.03 * r.length);
  }
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
