// Inercia del acercamiento con la rueda (ZoomSuave.jsx).
export const ZOOM_DECAY_PER_S = 5.5;
// Inercia del giro al arrastrar: fracción que OrbitControls frena por cuadro, referida a 120 cuadros por segundo
// (la pantalla del MacBook, donde se ajustó).
export const GIRO_AMORTIGUAMIENTO = 0.04;
// OrbitControls frena por cuadro; esto da el factor equivalente para un cuadro de `dt` segundos,
// así el giro dura lo mismo a 60 que a 138 cuadros por segundo.
export const amortiguamientoGiro = dt => 1 - (1 - GIRO_AMORTIGUAMIENTO) ** (dt * 120);
// Cambio total del logaritmo de la distancia por cada 100 de deltaY (una muesca de rueda).
export const ZOOM_PER_NOTCH = 0.11;

// Avance de un cuadro: nueva velocidad (log de distancia por segundo) y factor de distancia.
export function stepZoom(velocity, dt) {
  const decay = Math.exp(-ZOOM_DECAY_PER_S * dt);
  // Integral exacta de v·e^(−λt) en el cuadro: no depende de la frecuencia de cuadros.
  const travelled = velocity * (1 - decay) / ZOOM_DECAY_PER_S;
  return { velocity: velocity * decay, factor: Math.exp(travelled) };
}
