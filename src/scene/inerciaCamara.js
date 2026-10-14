// Inercia del acercamiento con la rueda (ZoomSuave.jsx).
export const ZOOM_DECAY_PER_S = 5.5;
// Cambio total del logaritmo de la distancia por cada 100 de deltaY (una muesca de rueda).
export const ZOOM_PER_NOTCH = 0.11;

// Avance de un cuadro: nueva velocidad (log de distancia por segundo) y factor de distancia.
export function stepZoom(velocity, dt) {
  const decay = Math.exp(-ZOOM_DECAY_PER_S * dt);
  // Integral exacta de v·e^(−λt) en el cuadro: no depende de la frecuencia de cuadros.
  const travelled = velocity * (1 - decay) / ZOOM_DECAY_PER_S;
  return { velocity: velocity * decay, factor: Math.exp(travelled) };
}
