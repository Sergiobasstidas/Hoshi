// Encuadre de la ruta completa de una sonda (clic en su ruta): la cámara sale del sistema solar,
// elevada sobre la eclíptica y a un costado de la ruta, un poco hacia el lado del Sol, de modo que el
// Sol quede a un lado de la pantalla y la sonda al otro, más lejos de la cámara (en perspectiva).
// La distancia es la menor con la que entran el Sol y toda la ruta con margen.

// Elevación sobre la eclíptica y cuánto se corre la cámara hacia el lado del Sol (grados).
export const ENCUADRE_ELEVACION_DEG = 40;
export const ENCUADRE_HACIA_SOL_DEG = 25;
// Margen en coordenadas normalizadas de pantalla (−1 a 1). Abajo se deja lugar a la línea de tiempo.
export const ENCUADRE_MARGEN = { lado: 0.6, arriba: 0.62, abajo: -0.62 };

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = a => { const length = Math.hypot(...a) || 1; return a.map(value => value / length); };

// Radio de la órbita de Neptuno (pc): el sistema solar entra entero en el encuadre.
const NEPTUNO_PC = 30.07 / 206264.806;

// `puntos`: Float64Array o lista plana de posiciones heliocéntricas (la ruta hasta hoy); `sonda`, la
// posición de hoy; `up`, la normal de la eclíptica; `fov` vertical en grados y `aspect` ancho/alto.
// Devuelve { target, direction, distance } para `navigate` (dirección del objetivo hacia la cámara).
export function encuadreRuta(puntos, sonda, up, fov, aspect) {
  const haciaSonda = unit(sonda);
  // Lado de la ruta: perpendicular a ella dentro de la eclíptica.
  let lado = cross(up, haciaSonda);
  if (Math.hypot(...lado) < 1e-6) lado = cross([1, 0, 0], haciaSonda);
  lado = unit(lado);
  // La sonda a la derecha de la pantalla y el Sol a la izquierda: con la cámara en `lado`, la derecha
  // de la pantalla es forward × up = (−lado) × up, que apunta hacia la sonda si (lado × up)·sonda < 0.
  if (dot(cross(lado, up), haciaSonda) > 0) lado = lado.map(value => -value);
  const enPlano = unit(haciaSonda.map((value, i) => value - up[i] * dot(haciaSonda, up)));
  const beta = ENCUADRE_HACIA_SOL_DEG * Math.PI / 180, elevacion = ENCUADRE_ELEVACION_DEG * Math.PI / 180;
  const horizontal = unit(lado.map((value, i) => value * Math.cos(beta) - enPlano[i] * Math.sin(beta)));
  const direction = unit(horizontal.map((value, i) => value * Math.cos(elevacion) + up[i] * Math.sin(elevacion)));
  let target = sonda.map(value => value / 2);

  // Base de la cámara mirando al objetivo con la vertical de la eclíptica.
  const forward = direction.map(value => -value);
  const right = unit(cross(forward, up));
  const arriba = cross(right, forward);
  const tanV = Math.tan(fov * Math.PI / 360), tanH = tanV * aspect;
  const lista = [[0, 0, 0], sonda];
  // La órbita de Neptuno, con 16 puntos en la eclíptica.
  const eje = unit(cross(up, [1, 0, 0])), eje2 = cross(up, eje);
  for (let k = 0; k < 16; k++) {
    const a = k / 16 * 2 * Math.PI;
    lista.push(eje.map((value, i) => (value * Math.cos(a) + eje2[i] * Math.sin(a)) * NEPTUNO_PC));
  }
  const paso = Math.max(1, Math.floor(puntos.length / 3 / 400));
  for (let k = 0; k < puntos.length / 3; k += paso) lista.push([puntos[k * 3], puntos[k * 3 + 1], puntos[k * 3 + 2]]);
  const proyectar = (punto, distance) => {
    const v = punto.map((value, i) => value - target[i] - direction[i] * distance);
    const z = dot(v, forward);
    return z <= 0 ? null : [dot(v, right) / (z * tanH), dot(v, arriba) / (z * tanV), z];
  };
  const entra = distance => lista.every(punto => {
    const p = proyectar(punto, distance);
    return p && Math.abs(p[0]) < ENCUADRE_MARGEN.lado && p[1] < ENCUADRE_MARGEN.arriba && p[1] > ENCUADRE_MARGEN.abajo;
  });
  const largo = Math.hypot(...sonda);
  const ajustar = () => {
    let cerca = largo * 0.2, lejos = largo * 20;
    for (let i = 0; i < 40; i++) {
      const medio = Math.sqrt(cerca * lejos);
      if (entra(medio)) lejos = medio; else cerca = medio;
    }
    return lejos;
  };
  // Dos pasadas: después de la primera, el objetivo se corre para centrar el conjunto en el espacio
  // libre de la pantalla (entre la línea de tiempo y el borde superior) y se vuelve a ajustar la distancia.
  let distance = ajustar();
  for (let pasada = 0; pasada < 2; pasada++) {
    const vistos = lista.map(punto => proyectar(punto, distance)).filter(Boolean);
    const xs = vistos.map(p => p[0]), ys = vistos.map(p => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2 - (ENCUADRE_MARGEN.arriba + ENCUADRE_MARGEN.abajo) / 2;
    target = target.map((value, i) => value + (right[i] * cx * tanH + arriba[i] * cy * tanV) * distance);
    distance = ajustar();
  }
  return { target, direction, distance };
}
