// Geometría cuyos atributos se sueltan de la memoria de JavaScript apenas llegan a la GPU.
// Three sube los atributos y, en el mismo cuadro, calcula la esfera envolvente para ordenar los objetos
// transparentes (WebGLRenderer.projectObject): para entonces los arreglos ya no están, así que se fija antes.
// No sirve para objetos que se eligen con el ratón: Points.raycast recorre las posiciones.
import * as THREE from 'three';

export function soltarAlSubir(atributo) {
  return atributo.onUpload(function liberar() { this.array = null; });
}

export function geometriaSoltada(atributos) {
  const g = new THREE.BufferGeometry();
  for (const [nombre, atributo] of Object.entries(atributos)) g.setAttribute(nombre, soltarAlSubir(atributo));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
  return g;
}
