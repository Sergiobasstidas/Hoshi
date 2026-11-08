import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { geometriaSoltada } from '../src/scene/geometriaGpu.js';

// Lo que hace three en cada cuadro con un objeto transparente: sube los atributos (y llama a onUpload, que aquí
// suelta el arreglo) y, en el mismo cuadro, toma el centro de la esfera envolvente para ordenarlo.
function primerCuadro(geometria) {
  for (const atributo of Object.values(geometria.attributes)) atributo.onUploadCallback.call(atributo);
  if (geometria.boundingSphere === null) geometria.computeBoundingSphere();
  return geometria.boundingSphere.center.clone();
}

const atributos = () => ({
  position: new THREE.BufferAttribute(new Float32Array([1, 2, 3, -4, 5, 6]), 3),
  magnitud: new THREE.BufferAttribute(new Float32Array([1, 2]), 1),
});

test('Geometría soltada: el primer cuadro no necesita los arreglos ya soltados', () => {
  const g = geometriaSoltada(atributos());
  assert.doesNotThrow(() => primerCuadro(g));
  assert.equal(g.getAttribute('position').array, null);
  assert.equal(g.getAttribute('position').count, 2);
  assert.equal(g.boundingSphere.radius, Infinity);
  // Un arreglo nuevo (otro origen) se vuelve a soltar al subirlo.
  const posicion = g.getAttribute('position');
  posicion.array = new Float32Array(6);
  posicion.needsUpdate = true;
  assert.doesNotThrow(() => primerCuadro(g));
  assert.equal(posicion.array, null);
});

test('Geometría soltada: sin esfera fija, el primer cuadro falla (el error que corrige)', () => {
  const g = geometriaSoltada(atributos());
  g.boundingSphere = null;
  assert.throws(() => primerCuadro(g), TypeError);
});
