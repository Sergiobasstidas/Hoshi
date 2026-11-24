// Elegir una estrella del campo con un clic: la más cercana al cursor en pantalla (hasta `radio` píxeles) entre las que
// se ven en el modo de visión actual; si hay varias, la más brillante vista desde la cámara.

// Posiciones (pc, J2000) y magnitudes absolutas de las estrellas, en arreglos planos para recorrerlas rápido.
export function prepararSeleccion(estrellas) {
  const n = estrellas.length, x = new Float64Array(n), y = new Float64Array(n), z = new Float64Array(n), m = new Float32Array(n);
  estrellas.forEach((s, k) => { x[k] = s.x; y[k] = s.y; z[k] = s.z; m[k] = Number.isFinite(s.m) ? s.m : 99; });
  return { estrellas, x, y, z, m };
}

// ¿Se ve con el modo actual? En «Mapa» (fisico = 0) se ven todas; en «A simple vista» y «Binoculares», las que desde la
// cámara llegan hasta un poco más allá del límite (el punto se funde ahí, StarField.jsx).
export const MARGEN_LIMITE = 1;

// `matriz`: proyección × vista de la cámara (16 números, por columnas) en coordenadas locales (estrella − origen);
// `origen` y `camara`: el origen local y la posición de la cámara en coordenadas del catálogo; `cx`, `cy`: el cursor en
// píxeles del lienzo de `ancho` × `alto`. Devuelve el índice de la estrella o −1.
export function estrellaBajoCursor(datos, { matriz: e, origen, camara, ancho, alto, cx, cy, radio = 8, fisico = 0, limite = 6 }) {
  const { x, y, z, m } = datos, r2 = radio * radio;
  let mejor = -1, mejorMag = Infinity;
  for (let k = 0; k < x.length; k++) {
    const lx = x[k] - origen[0], ly = y[k] - origen[1], lz = z[k] - origen[2];
    const w = e[3] * lx + e[7] * ly + e[11] * lz + e[15];
    if (!(w > 0)) continue;
    const px = ((e[0] * lx + e[4] * ly + e[8] * lz + e[12]) / w + 1) * ancho / 2 - cx;
    if (px > radio || px < -radio) continue;
    const py = (1 - (e[1] * lx + e[5] * ly + e[9] * lz + e[13]) / w) * alto / 2 - cy;
    if (px * px + py * py > r2) continue;
    const d = Math.hypot(x[k] - camara[0], y[k] - camara[1], z[k] - camara[2]);
    const aparente = m[k] + 5 * Math.log10(Math.max(d, 1e-9) / 10);
    if (fisico && aparente > limite + MARGEN_LIMITE) continue;
    if (aparente < mejorMag) { mejorMag = aparente; mejor = k; }
  }
  return mejor;
}

// ¿El nombre ya se ve en la escena (etiqueta normal o de contexto, de una compañera o bajo la marca del buscador)?
// Entonces el nombre al pasar el mouse no lo repite. `visibles`: [{ texto, visible }].
export const nombreYaVisible = (nombre, visibles) => visibles.some(e => e.visible && e.texto.trim() === nombre);
