// Estela que se desvanece detrás de un cuerpo en movimiento (lunas; pensada también para las
// sondas): la trayectoria real de los últimos `span` días, muestreada con la función de posición
// del propio cuerpo. El punto 0 es la cola (transparente) y el último, el cuerpo (opaco).
// Lo dibuja FadingTrails.jsx; la forma de desvanecerse es estilo, no dato.
export const TRAIL_SAMPLES = 96;

// `positionAt(día juliano)` → [x, y, z] en las unidades de la escena; `endJd`, fecha del cuerpo.
export function sampleTrail(positionAt, endJd, spanDays, samples = TRAIL_SAMPLES) {
  const points = new Float32Array(samples * 3);
  for (let k = 0; k < samples; k++) {
    const jd = endJd - spanDays * (1 - k / (samples - 1));
    points.set(positionAt(jd), k * 3);
  }
  return points;
}

// Une varias estelas en segmentos sueltos (una sola llamada de dibujo) con, por vértice, el
// avance a lo largo de la estela (0 cola, 1 cabeza), su color, su peso y su tamaño de referencia
// (para que cada estela aparezca según cuántos píxeles ocupa su órbita).
export function mergeTrails(trails) {
  const segments = trails.reduce((sum, trail) => sum + trail.points.length / 3 - 1, 0);
  const position = new Float32Array(segments * 6), progress = new Float32Array(segments * 2);
  const color = new Float32Array(segments * 6), weight = new Float32Array(segments * 2), size = new Float32Array(segments * 2);
  const fadeOut = new Float32Array(segments * 2);
  let v = 0;
  for (const trail of trails) {
    const count = trail.points.length / 3;
    for (let k = 0; k < count - 1; k++) {
      for (const j of [k, k + 1]) {
        position.set(trail.points.subarray(j * 3, j * 3 + 3), v * 3);
        progress[v] = j / (count - 1);
        color.set(trail.color, v * 3);
        weight[v] = trail.weight ?? 1;
        size[v] = trail.size;
        // Píxeles a partir de los que la estela se retira (vista desde muy dentro de su órbita).
        fadeOut[v] = trail.fadeOutPixels ?? Infinity;
        v++;
      }
    }
  }
  return { position, progress, color, weight, size, fadeOut };
}
