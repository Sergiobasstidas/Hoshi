import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { DURACION_ENFOQUE_S, avanzarEnfoque, centroVisible, crearEnfoque } from '../src/scene/enfoque.js';

// Cámara en el origen mirando hacia −z, con la vertical +y.
const camara = (aspecto = 16 / 10) => { const c = new PerspectiveCamera(50, aspecto, 0.1, 100); c.lookAt(0, 0, -1); c.updateMatrixWorld(); return c; };
const adelante = c => new Vector3(0, 0, -1).applyQuaternion(c.quaternion);
// Ángulo de roll: la derecha de la cámara debe quedar perpendicular a la vertical.
const roll = (c, arriba = new Vector3(0, 1, 0)) => Math.abs(new Vector3(1, 0, 0).applyQuaternion(c.quaternion).dot(arriba));
const correr = (c, e, pasos = 200) => { let fin = false; const vistos = []; for (let k = 0; k < pasos && !fin; k++) { fin = avanzarEnfoque(c, e, 1 / 60); vistos.push(adelante(c)); } return { fin, vistos }; };
// Dónde se ve un punto en la pantalla ([−1, 1]).
const enPantalla = (c, punto) => { c.updateMatrixWorld(); const p = punto.clone().project(c); return [p.x, p.y]; };

test('el giro deja la estrella en el centro, sin roll y en el tiempo pedido', () => {
  const c = camara(), estrella = new Vector3(30, 12, -10);
  const e = crearEnfoque(c, estrella.clone().normalize(), { fov: c.fov, aspecto: c.aspect });
  assert.ok(e);
  const { fin, vistos } = correr(c, e);
  assert.ok(fin);
  assert.ok(Math.abs(vistos.length / 60 - DURACION_ENFOQUE_S) < 0.05);
  assert.ok(adelante(c).angleTo(estrella) < 1e-6);
  for (const v of vistos) assert.ok(Number.isFinite(v.x));
  assert.ok(roll(c) < 1e-9);
});

test('el camino es el más corto: el ángulo a la estrella baja siempre y suma el ángulo de partida', () => {
  const c = camara(), estrella = new Vector3(-5, -3, 2).normalize();
  const inicio = adelante(c).angleTo(estrella);
  const e = crearEnfoque(c, estrella);
  const { vistos } = correr(c, e);
  let anterior = inicio, recorrido = 0, previo = new Vector3(0, 0, -1);
  for (const v of vistos) {
    const a = v.angleTo(estrella);
    assert.ok(a <= anterior + 1e-9);
    anterior = a; recorrido += v.angleTo(previo); previo = v;
  }
  assert.ok(Math.abs(recorrido - inicio) < 1e-6);
  assert.ok(inicio < Math.PI);
});

test('cada cuadro del giro mantiene el horizonte (sin roll)', () => {
  const c = camara(), e = crearEnfoque(c, new Vector3(1, 0.8, 0.3).normalize());
  for (let k = 0; k < 60; k++) { avanzarEnfoque(c, e, 1 / 60); assert.ok(roll(c) < 1e-9, `cuadro ${k}`); }
});

test('una estrella a la espalda: media vuelta alrededor de la vertical, sin dar la vuelta de cabeza', () => {
  const c = camara(), e = crearEnfoque(c, new Vector3(0, 0, 1));
  assert.ok(Math.abs(e.angulo - Math.PI) < 1e-9);
  const { vistos } = correr(c, e);
  for (const v of vistos) { assert.ok(Math.abs(v.y) < 1e-9); }
  assert.ok(adelante(c).angleTo(new Vector3(0, 0, 1)) < 1e-6);
  assert.ok(roll(c) < 1e-9);
});

test('cancelar y reemplazar: el giro nuevo parte de donde quedó la cámara, sin saltos', () => {
  const c = camara(), e1 = crearEnfoque(c, new Vector3(1, 0, 0));
  for (let k = 0; k < 20; k++) avanzarEnfoque(c, e1, 1 / 60);
  const aMitad = adelante(c);
  // Cancelado: no se sigue avanzando y la cámara queda donde estaba.
  assert.ok(aMitad.angleTo(new Vector3(0, 0, -1)) > 0.05 && aMitad.angleTo(new Vector3(1, 0, 0)) > 0.05);
  const e2 = crearEnfoque(c, new Vector3(0, 1, -1).normalize());
  assert.ok(e2.desde.angleTo(aMitad) < 1e-9);
  avanzarEnfoque(c, e2, 1 / 60);
  assert.ok(adelante(c).angleTo(aMitad) < 0.01);
});

test('cerca del centro no gira; con «reducir movimiento» gira de una vez', () => {
  const c = camara();
  assert.equal(crearEnfoque(c, new Vector3(0.01, 0, -1).normalize()), null);
  const e = crearEnfoque(c, new Vector3(1, 0, 0), { reducido: true });
  assert.equal(avanzarEnfoque(c, e, 0), true);
  assert.ok(adelante(c).angleTo(new Vector3(1, 0, 0)) < 1e-6);
});

test('con la ficha a la izquierda (o abajo en el teléfono), la estrella queda en el centro de lo que se ve', () => {
  const lienzo = { left: 0, top: 0, right: 1440, bottom: 900, width: 1440, height: 900 };
  const ndc = centroVisible(lienzo, { left: 0, top: 0, right: 520, bottom: 900, width: 520, height: 900 });
  assert.ok(Math.abs(ndc[0] - ((520 + 1440) / 2 / 720 - 1)) < 1e-9 && ndc[1] === 0);
  const telefono = { left: 0, top: 0, right: 390, bottom: 844, width: 390, height: 844 };
  const ndcT = centroVisible(telefono, { left: 0, top: 500, right: 390, bottom: 844, width: 390, height: 344 });
  assert.ok(ndcT[0] === 0 && Math.abs(ndcT[1] - (1 - 250 / 422)) < 1e-9);
  // Ficha en el medio y controles arriba hasta 160 px: la franja libre más alta es la de abajo (664 a 844).
  const ndcM = centroVisible(telefono, { left: 0, top: 212, right: 390, bottom: 664, width: 390, height: 452 }, 160);
  assert.ok(Math.abs(ndcM[1] - (1 - 2 * 754 / 844)) < 1e-9);
  assert.deepEqual(centroVisible(lienzo, null), [0, 0]);
  const c = camara(1440 / 900), estrella = new Vector3(-20, 5, 3);
  const e = crearEnfoque(c, estrella.clone().normalize(), { fov: c.fov, aspecto: c.aspect, ndc });
  correr(c, e);
  const [x, y] = enPantalla(c, estrella);
  assert.ok(Math.abs(x - ndc[0]) < 1e-4 && Math.abs(y - ndc[1]) < 1e-4, `${x} ${y}`);
  assert.ok(roll(c) < 1e-9);
});

test('fijada: con la cámara en otro lugar, la estrella vuelve a quedar en el centro de lo que se ve', async () => {
  const { direccionFinal, orientacionMirando } = await import('../src/scene/enfoque.js');
  const c = camara(), estrella = new Vector3(40, 10, -80), arriba = new Vector3(0, 1, 0), ndc = [0.3, 0];
  for (const paso of [new Vector3(5, 0, 0), new Vector3(0, 3, -20), new Vector3(-12, -4, 6)]) {
    c.position.add(paso);
    orientacionMirando(direccionFinal(estrella.clone().sub(c.position).normalize(), arriba, { fov: c.fov, aspecto: c.aspect, ndc }), arriba, c.quaternion);
    const [x, y] = enPantalla(c, estrella);
    assert.ok(Math.abs(x - ndc[0]) < 1e-4 && Math.abs(y) < 1e-4);
    assert.ok(roll(c) < 1e-9);
  }
});

test('cada forma de soltar la fijación', async () => {
  const { siguienteEnfoque } = await import('../src/scene/enfoque.js');
  const a = { i: 1 }, b = { i: 2 };
  const fija = siguienteEnfoque(null, { tipo: 'elegir', estrella: a });
  assert.deepEqual(fija, { estrella: a, fijada: true });
  assert.equal(siguienteEnfoque(fija, { tipo: 'elegir', estrella: a }), fija); // la misma estrella no la suelta
  assert.deepEqual(siguienteEnfoque(fija, { tipo: 'elegir', estrella: b }), { estrella: b, fijada: true }); // pasa a la otra
  assert.equal(siguienteEnfoque(fija, { tipo: 'mover' }), fija); // teclas, rueda o «Ir a»: sigue fija
  assert.deepEqual(siguienteEnfoque(fija, { tipo: 'arrastrar' }), { estrella: a, fijada: false }); // mirar a otro lado: sigue elegida
  assert.equal(siguienteEnfoque(fija, { tipo: 'clicVacio' }), null); // clic en el vacío: suelta y quita la selección
  assert.equal(siguienteEnfoque(fija, { tipo: 'clicVacio', arrastre: true }), fija); // el fin de un arrastre no cuenta
  assert.deepEqual(siguienteEnfoque(fija, { tipo: 'escape' }), { estrella: a, fijada: false });
  assert.equal(siguienteEnfoque(fija, { tipo: 'cerrarFicha' }), null);
  assert.equal(siguienteEnfoque(fija, { tipo: 'otraSeleccion' }), null);
});

test('una estrella casi en la vertical (Polaris) no se corre al costado: queda en el centro, sin roll', () => {
  const c = new PerspectiveCamera(50, 1.6, 0.1, 100); c.up.set(0, 0, 1); c.lookAt(1, 0, 0); c.updateMatrixWorld();
  const polaris = new Vector3(0.01, 0.008, 1).normalize();
  const e = crearEnfoque(c, polaris, { fov: 50, aspecto: 1.6, ndc: [0.333, 0], arriba: c.up });
  correr(c, e);
  const [x, y] = enPantalla(c, polaris.clone().multiplyScalar(50));
  assert.ok(Math.abs(x) < 1e-3 && Math.abs(y) < 1e-3, `${x} ${y}`);
  assert.ok(roll(c, c.up) < 1e-9);
});

test('al terminar el giro la cámara no se mueve: los controles de órbita quedan en el mismo lugar', async () => {
  const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
  const { centroDeOrbita, crearEnfoque } = await import('../src/scene/enfoque.js');
  const KM = 1 / 3.0857e13, SOL_RADIO = 696000 * KM;
  // Elemento falso: los controles solo agregan escuchas.
  const dom = { style: {}, addEventListener() {}, removeEventListener() {}, ownerDocument: { addEventListener() {}, removeEventListener() {} }, getRootNode() { return { addEventListener() {}, removeEventListener() {} }; } };
  // Casos: a 38.226 km de la Tierra, cerca de la Luna, de Júpiter, junto a la Voyager 1 y en la vista SDO del Sol.
  const casos = [
    { nombre: 'Tierra', distancia: 38226 * KM, minimo: 6371 * KM * 1.1 },
    { nombre: 'Luna', distancia: 12000 * KM, minimo: 1737 * KM * 1.1 },
    { nombre: 'Júpiter', distancia: 400000 * KM, minimo: 69911 * KM * 1.1 },
    { nombre: 'Voyager 1', distancia: 1000 * KM, minimo: 1e-12 },
    { nombre: 'Sol (SDO)', distancia: 3 * SOL_RADIO, minimo: SOL_RADIO * 1.02 },
  ];
  for (const caso of casos) {
    const c = camara(); c.up.set(0, 0, 1);
    // Coordenadas como las de la escena: relativas a un origen cercano (Sol o estrella), a lo más unas 160 UA.
    const centroAnterior = [7.8e-4, 2e-5, 3e-5];
    c.position.set(centroAnterior[0] + caso.distancia, centroAnterior[1], centroAnterior[2]); c.lookAt(...centroAnterior); c.updateMatrixWorld();
    const antes = c.position.clone();
    // Gira hacia una estrella cualquiera, lejos del centro de la pantalla.
    const e = crearEnfoque(c, new Vector3(-0.2, 0.9, 0.4).normalize(), { fov: c.fov, aspecto: c.aspect, ndc: [0.33, 0], arriba: c.up });
    correr(c, e);
    const adelante = new Vector3(0, 0, -1).applyQuaternion(c.quaternion).toArray();
    const centro = centroDeOrbita(c.position.toArray(), adelante, centroAnterior);
    const controles = new OrbitControls(c, dom);
    controles.minDistance = caso.minimo; controles.maxDistance = 1e6;
    controles.target.set(...centro);
    controles.update();
    assert.ok(c.position.distanceTo(antes) < caso.distancia * 1e-5, `${caso.nombre}: se movió ${c.position.distanceTo(antes) / KM} km`);
    assert.ok(new Vector3(0, 0, -1).applyQuaternion(c.quaternion).angleTo(new Vector3(...adelante)) < 1e-4, `${caso.nombre}: ${new Vector3(0, 0, -1).applyQuaternion(c.quaternion).angleTo(new Vector3(...adelante))}`);
  }
});

test('giros grandes (135° y a la espalda) sin roll en ningún cuadro, con la vertical en el polo celeste', () => {
  const arriba = new Vector3(0, 0, 1);
  for (const [desde, hacia] of [[new Vector3(-0.1, 0.6, -0.8), new Vector3(0.01, 0.008, 1)], [new Vector3(1, 0, 0.1), new Vector3(-0.7, 0.7, 0.2)], [new Vector3(0, 1, 0), new Vector3(0, -1, 0)]]) {
    const c = new PerspectiveCamera(50, 1.6, 0.1, 100); c.up.copy(arriba); c.lookAt(desde.normalize()); c.updateMatrixWorld();
    const e = crearEnfoque(c, hacia.normalize(), { fov: 50, aspecto: 1.6, ndc: [0.33, 0], arriba });
    assert.ok(e.angulo > 1.5, `${e.angulo}`);
    let maximo = 0;
    for (let k = 0; k < 120; k++) { avanzarEnfoque(c, e, 1 / 60); maximo = Math.max(maximo, roll(c, arriba)); }
    assert.ok(maximo < 1e-9, `roll máximo ${maximo}`);
  }
});
