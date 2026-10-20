// Ocultación de nombres por cuerpos más cercanos a la cámara. Cada componente que dibuja
// esferas publica sus discos en pantalla; un nombre se oculta si su recuadro toca el disco de
// un cuerpo que está delante del objeto nombrado.
const sources = new Map();

// disks: [{ key, x, y, radius, distance }] en píxeles y en la unidad de distancia de la escena.
export function publishOccluders(source, disks) {
  sources.set(source, disks);
}

export function currentOccluders() {
  return [...sources.values()].flat();
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
