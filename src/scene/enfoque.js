// Enfoque de cámara: al elegir una estrella, la cámara gira sin moverse de lugar hasta dejarla en el centro del espacio
// que se ve (sin la ficha). El giro sigue el camino más corto entre la dirección de partida y la final, con inicio y fin
// suaves, y la cámara mira siempre con la misma vertical (sin inclinar el horizonte).
import { Matrix4, Quaternion, Vector3 } from 'three';

export const DURACION_ENFOQUE_S = 0.9;

// Giros cortados por el usuario (arrastre, rueda, teclado o toque): EnfoqueCamara.jsx los corta donde estén.
const cortados = new WeakSet();
export const cortarGiro = (pedido, despertar = () => {}) => { if (pedido) { cortados.add(pedido); despertar(); } };
export const giroCortado = pedido => Boolean(pedido) && cortados.has(pedido);
// Si la estrella ya está a menos de esto del punto donde debe quedar, no se gira.
export const UMBRAL_ENFOQUE_RAD = 2 * Math.PI / 180;

const CERO = new Vector3();
const matriz = new Matrix4();

// Orientación de una cámara que mira hacia `adelante` con la vertical `arriba` (como Object3D.lookAt): sin roll.
export function orientacionMirando(adelante, arriba, destino = new Quaternion()) {
  matriz.lookAt(CERO, adelante, arriba);
  return destino.setFromRotationMatrix(matriz);
}

// Dirección del rayo de la cámara que pasa por el punto `ndc` de la pantalla ([−1, 1] en x e y), con orientación q.
function rayo(q, ndc, tanY, aspecto) {
  return new Vector3(ndc[0] * tanY * aspecto, ndc[1] * tanY, -1).normalize().applyQuaternion(q);
}

// Hacia dónde debe mirar la cámara para que la estrella (dirección `haciaEstrella`, unitaria) quede en `ndc`. Cerca de
// la vertical (una estrella casi en el polo, como Polaris con la vertical en el polo celeste) no se puede correr hacia el
// costado sin inclinar el horizonte: entonces se corre solo en altura, cada vez menos, y si tampoco, queda en el centro de
// la pantalla. Así, en el teléfono, una estrella cerca del polo sur (beta Hydri) no termina bajo la ficha.
export function direccionFinal(haciaEstrella, arriba, { fov = 50, aspecto = 1, ndc = [0, 0] } = {}) {
  const tanY = Math.tan(fov * Math.PI / 360), hacia = haciaEstrella.clone().normalize();
  const q = new Quaternion(), giro = new Quaternion();
  for (const punto of [ndc, [0, ndc[1]], [0, ndc[1] * 0.75], [0, ndc[1] * 0.5], [0, ndc[1] * 0.25], [0, 0]]) {
    const adelante = hacia.clone();
    if (!punto[0] && !punto[1]) return adelante;
    for (let k = 0; k < 12; k++) {
      orientacionMirando(adelante, arriba, q);
      giro.setFromUnitVectors(rayo(q, punto, tanY, aspecto), hacia);
      adelante.applyQuaternion(giro).normalize();
    }
    orientacionMirando(adelante, arriba, q);
    if (rayo(q, punto, tanY, aspecto).angleTo(hacia) < 1e-4) return adelante;
  }
  return hacia;
}

// Estado del giro, o null si no hace falta girar. `camara`: { quaternion, up }; `haciaEstrella`: dirección mundial de la
// cámara a la estrella. `reducido`: con «reducir movimiento» del sistema, el giro es inmediato.
export function crearEnfoque(camara, haciaEstrella, { fov, aspecto, ndc, arriba = camara.up, reducido = false } = {}) {
  const desde = new Vector3(0, 0, -1).applyQuaternion(camara.quaternion).normalize();
  const hasta = direccionFinal(haciaEstrella, arriba, { fov, aspecto, ndc });
  const angulo = desde.angleTo(hasta);
  if (angulo < UMBRAL_ENFOQUE_RAD) return null;
  let eje = desde.clone().cross(hasta);
  // A la espalda de la cámara (180°): se da la vuelta alrededor de la vertical, sin pasar por arriba.
  if (eje.lengthSq() < 1e-12) eje = arriba.clone().projectOnPlane(desde);
  if (eje.lengthSq() < 1e-12) eje = new Vector3(0, 1, 0).projectOnPlane(desde);
  eje.normalize();
  const vertical = arriba.clone().normalize();
  return { desde, hasta, eje, angulo, arriba: vertical, acimut: pasaCercaDeLaVertical(desde, eje, angulo, vertical) ? acimutYAltura(desde, hasta, vertical) : null,
    t: 0, duracion: reducido ? 0 : DURACION_ENFOQUE_S };
}

// Un giro por el círculo máximo que pasa cerca del cenit o del nadir de la vertical hace girar la imagen hasta 180° en un
// solo cuadro (la cámara no se inclina, así que ahí cambia de golpe hacia dónde mira). Entonces se interpola el acimut
// (por el lado corto) y la altura respecto de la vertical.
export const CERCA_DE_LA_VERTICAL_RAD = 10 * Math.PI / 180;
function pasaCercaDeLaVertical(desde, eje, angulo, arriba) {
  const v = new Vector3();
  for (let k = 0; k <= 64; k++) {
    v.copy(desde).applyAxisAngle(eje, angulo * k / 64);
    if (Math.abs(v.dot(arriba)) > Math.cos(CERCA_DE_LA_VERTICAL_RAD)) return true;
  }
  return false;
}
function acimutYAltura(desde, hasta, arriba) {
  // Base horizontal: una dirección perpendicular a la vertical y otra perpendicular a ambas.
  const x = (Math.abs(arriba.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0)).projectOnPlane(arriba).normalize();
  const y = arriba.clone().cross(x);
  const polar = v => ({ alt: Math.asin(Math.max(-1, Math.min(1, v.dot(arriba)))), az: Math.atan2(v.dot(y), v.dot(x)), plano: Math.hypot(v.dot(x), v.dot(y)) });
  const a = polar(desde), b = polar(hasta);
  // Justo en el cenit el acimut no está definido: se toma el del otro extremo.
  const az0 = a.plano > 1e-9 ? a.az : b.az, az1 = b.plano > 1e-9 ? b.az : az0;
  let daz = az1 - az0;
  daz -= 2 * Math.PI * Math.round(daz / (2 * Math.PI));
  return { x, y, alt0: a.alt, alt1: b.alt, az0, daz };
}
export function direccionEnGiro(enfoque, avance) {
  const p = enfoque.acimut;
  if (!p) return enfoque.desde.clone().applyAxisAngle(enfoque.eje, enfoque.angulo * avance);
  const alt = p.alt0 + (p.alt1 - p.alt0) * avance, az = p.az0 + p.daz * avance;
  return p.x.clone().multiplyScalar(Math.cos(alt) * Math.cos(az)).addScaledVector(p.y, Math.cos(alt) * Math.sin(az))
    .addScaledVector(enfoque.arriba, Math.sin(alt)).normalize();
}

export const suavizado = t => t * t * t * (t * (6 * t - 15) + 10);

// Avanza el giro `delta` segundos y orienta la cámara. Devuelve true al terminar.
export function avanzarEnfoque(camara, enfoque, delta) {
  enfoque.t = enfoque.duracion ? Math.min(enfoque.duracion, enfoque.t + Math.min(Math.max(delta, 0), 0.05)) : 0;
  const avance = enfoque.duracion ? suavizado(enfoque.t / enfoque.duracion) : 1;
  const adelante = avance >= 1 ? enfoque.hasta.clone() : direccionEnGiro(enfoque, avance);
  orientacionMirando(adelante, enfoque.arriba, camara.quaternion);
  camara.updateMatrixWorld?.();
  return avance >= 1;
}

// Centro del espacio que se ve, en coordenadas de pantalla [−1, 1]: sin la ficha, que ocupa la izquierda en el
// computador; en el teléfono ocupa el medio o la parte de abajo, y se usa la franja libre más alta entre los controles de
// arriba (`techo`, el borde inferior del buscador y los menús) y la ficha, o bajo la ficha. `ficha` y `lienzo`:
// rectángulos { left, top, right, bottom, width, height }.
export function centroVisible(lienzo, ficha, techo = lienzo.top) {
  let x0 = lienzo.left, x1 = lienzo.right, y0 = lienzo.top, y1 = lienzo.bottom;
  if (ficha && ficha.width > 0 && ficha.height > 0) {
    const ancha = ficha.width > 0.7 * lienzo.width;
    if (!ancha && ficha.left <= lienzo.left + 40) x0 = Math.max(x0, ficha.right);
    else if (!ancha && ficha.right >= lienzo.right - 40) x1 = Math.min(x1, ficha.left);
    else {
      const arriba = [Math.max(lienzo.top, techo), Math.min(lienzo.bottom, ficha.top)];
      const abajo = [Math.max(lienzo.top, ficha.bottom), lienzo.bottom];
      // Con el teléfono en horizontal la ficha ocupa todo el alto: sin franja libre no se recorta en vertical.
      if (arriba[1] - arriba[0] > 0 || abajo[1] - abajo[0] > 0) [y0, y1] = arriba[1] - arriba[0] >= abajo[1] - abajo[0] ? arriba : abajo;
    }
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return [2 * (cx - lienzo.left) / lienzo.width - 1, 1 - 2 * (cy - lienzo.top) / lienzo.height];
}

// Fijación de la estrella elegida después del giro. `estado`: { estrella, fijada } o null. Eventos:
//  elegir (otra estrella pasa la fijación; la misma no cambia nada), mover (teclas, rueda, «Ir a»: sigue fija),
//  arrastrar (mirar a otro lado: suelta la fijación pero la estrella sigue elegida), clicVacio (suelta y quita la
//  selección; el fin de un arrastre no cuenta), escape, cerrarFicha y otraSeleccion (planeta, sonda, cúmulo: manda esa).
export function siguienteEnfoque(estado, evento) {
  switch (evento.tipo) {
    case 'elegir': return estado?.estrella === evento.estrella ? estado : { estrella: evento.estrella, fijada: true };
    case 'mover': return estado;
    case 'arrastrar': return estado && { ...estado, fijada: false };
    case 'clicVacio': return evento.arrastre ? estado : null;
    case 'escape': return estado && { ...estado, fijada: false };
    case 'cerrarFicha': case 'otraSeleccion': return null;
    default: return estado;
  }
}

// Centro de la órbita al terminar el giro: en la dirección en que mira la cámara, a la misma distancia que el centro
// anterior. Así, al volver los controles de órbita (que miran siempre a su centro y respetan sus distancias mínima y
// máxima, ya cumplidas por la distancia anterior), la cámara no se mueve. Con `estrella`, el centro nunca queda más allá
// de ella: acercarse con la rueda no la pasa de largo.
export function centroDeOrbita(camara, adelante, centroAnterior, estrella = null) {
  let radio = Math.hypot(...camara.map((v, i) => v - centroAnterior[i]));
  if (estrella) radio = Math.min(radio, Math.hypot(...camara.map((v, i) => v - estrella[i])));
  return camara.map((v, i) => v + adelante[i] * radio);
}
