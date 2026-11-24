import * as THREE from 'three';

// Ruido 3D de n³ para los grumos del polvo de la opción B (galaxiaShaders.js): gaussiana de media 0 y σ 1 suavizada con
// un vecindario 3×3×3 periódico y vuelta a normalizar, guardada como gaussiana/6 + 0,5 en un canal de 8 bits.
export function valoresRuido3D(n = 64, semilla = 1873) {
  let s = semilla >>> 0;
  const azar = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const gauss = () => Math.sqrt(-2 * Math.log(Math.max(azar(), 1e-12))) * Math.cos(2 * Math.PI * azar());
  const bruto = Float32Array.from({ length: n * n * n }, gauss), liso = new Float32Array(n * n * n);
  const i3 = (x, y, z) => ((z + n) % n) * n * n + ((y + n) % n) * n + ((x + n) % n);
  let suma = 0, suma2 = 0;
  for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let v = 0;
    for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) v += bruto[i3(x + dx, y + dy, z + dz)];
    liso[i3(x, y, z)] = v; suma += v; suma2 += v * v;
  }
  const media = suma / liso.length, sigma = Math.sqrt(suma2 / liso.length - media * media);
  return Uint8Array.from(liso, v => Math.round(Math.min(1, Math.max(0, (v - media) / sigma / 6 + 0.5)) * 255));
}
export function crearRuido3D(n = 64) {
  const t = new THREE.Data3DTexture(valoresRuido3D(n), n, n, n);
  t.format = THREE.RedFormat; t.type = THREE.UnsignedByteType;
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = t.wrapR = THREE.RepeatWrapping;
  t.unpackAlignment = 1; t.needsUpdate = true;
  return t;
}
