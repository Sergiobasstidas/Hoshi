import { Vector3 } from 'three';

// Ocultación de nombres por cuerpos más cercanos a la cámara. Cada componente que dibuja
// esferas publica sus discos en pantalla; un nombre se oculta si su recuadro toca el disco de
// un cuerpo que está delante del objeto nombrado.
const sources = new Map();

// disks: [{ key, x, y, radius, distance }] en píxeles y en la unidad de distancia de la escena.
export function publishOccluders(source, disks) {
  sources.set(source, disks);
}

const reprojected = new Vector3();
// Sin cámara, los discos tal como se publicaron. Con cámara y tamaño del lienzo, los que traen su esfera
// (`center`, `radiusPc`) se proyectan de nuevo con la cámara de este cuadro: cada fuente los publica en
// su propio useFrame y, al girar, los del cuadro anterior quedaban corridos y los nombres junto al borde
// de un disco parpadeaban.
export function currentOccluders(camera = null, size = null) {
  const disks = [...sources.values()].flat();
  if (!camera || !size) return disks;
  const focal = size.height / (2 * Math.tan(camera.fov * Math.PI / 360));
  return disks.flatMap(disk => {
    if (!disk.center) return [disk];
    reprojected.set(...disk.center).applyMatrix4(camera.matrixWorldInverse);
    const distance = reprojected.length();
    if (-reprojected.z <= 0 || !(distance > disk.radiusPc)) return [];
    reprojected.applyMatrix4(camera.projectionMatrix);
    return [{ ...disk, x: (reprojected.x + 1) * size.width / 2, y: (1 - reprojected.y) * size.height / 2,
      radius: disk.radiusPc / distance * focal, distance }];
  });
}

// Disco en pantalla de una esfera, o null si está detrás de la cámara o es demasiado pequeña.
export function screenDisk(key, viewPosition, radius, projected, focal, minimumPixels = 3) {
  const distance = Math.hypot(viewPosition.x, viewPosition.y, viewPosition.z);
  if (!(radius > 0) || -viewPosition.z <= 0 || !(distance > radius)) return null;
  const pixels = radius / distance * focal;
  return pixels >= minimumPixels ? { key, x: projected.x, y: projected.y, radius: pixels, distance } : null;
}

// box: { x, y, width, height } (esquina superior izquierda), distance: del objeto nombrado.
export function hiddenBehind(box, distance, disks, ownKey) {
  return disks.some(disk => {
    if (disk.key === ownKey || !(disk.distance < distance)) return false;
    const nearestX = Math.max(box.x, Math.min(disk.x, box.x + box.width));
    const nearestY = Math.max(box.y, Math.min(disk.y, box.y + box.height));
    return Math.hypot(disk.x - nearestX, disk.y - nearestY) < disk.radius;
  });
}

// Los discos pueden traer también su esfera en coordenadas de la escena (`center`, en pc, y
// `radiusPc`). rayHidden dice si un rayo (el del puntero: origen en la cámara, dirección unitaria)
// choca con alguna de esas esferas antes de `distance`: así un clic o el paso del ratón no llegan a
// una línea que está detrás de un planeta, una luna o el Sol. Intersección analítica rayo-esfera; si la
// cámara está dentro de una esfera, esa no cuenta.
export function rayHidden(ray, distance, disks = currentOccluders()) {
  const { origin, direction } = ray;
  return disks.some(({ center, radiusPc }) => {
    if (!center || !(radiusPc > 0)) return false;
    const ox = origin.x - center[0], oy = origin.y - center[1], oz = origin.z - center[2];
    const b = ox * direction.x + oy * direction.y + oz * direction.z;
    const c = ox * ox + oy * oy + oz * oz - radiusPc * radiusPc;
    if (c <= 0) return false;
    const discriminant = b * b - c;
    if (discriminant < 0) return false;
    const entry = -b - Math.sqrt(discriminant);
    return entry > 0 && entry < distance;
  });
}

const anchor = new Vector3();
// Nombre anclado en un punto de la escena (pc, relativo al origen) cuyo recuadro, de `width` px desde
// `left` px a la izquierda del punto y 16 de alto, cae sobre un cuerpo más cercano a la cámara. Con
// `width` 0 se prueba solo el punto (marcas pequeñas). Detrás de la cámara no se oculta: ahí el Html ya
// no se dibuja.
export function anchorHidden(x, y, z, camera, size, width = 0, left = 0, disks = currentOccluders(camera, size)) {
  anchor.set(x, y, z);
  const distance = anchor.distanceTo(camera.position);
  anchor.project(camera);
  if (!(anchor.z < 1)) return false;
  const screenX = (anchor.x + 1) / 2 * size.width, screenY = (1 - anchor.y) / 2 * size.height;
  return hiddenBehind(width ? { x: screenX - left, y: screenY - 8, width, height: 16 } : { x: screenX, y: screenY, width: 0, height: 0 },
    distance, disks, null);
}
