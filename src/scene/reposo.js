import { useEffect, useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

// Dibujar solo cuando algo cambia. Con la escena quieta el cuadro es idéntico al anterior,
// así que volver a dibujarlo 60 o 120 veces por segundo solo calienta la GPU.
// Tras cualquier cambio se sigue dibujando ESPERA_S para que terminen los fundidos.
const ESPERA_S = 2.5;
let activoHasta = 0;
let despertar = () => {};

// También para lo que se anima solo (la superficie de una estrella de cerca, los destellos de exoplanetas).
export function mantenerActivo(segundos = 0.25) {
  const ahora = performance.now();
  const dormido = ahora >= activoHasta;
  activoHasta = Math.max(activoHasta, ahora + segundos * 1000);
  if (dormido) despertar();
}

// La cámara que gira sola (GiroLento.jsx) no despierta el dibujo continuo: pide sus propios cuadros, a
// menor ritmo, y mientras tanto lo demás que se anima avanza a ese mismo ritmo.
export const giroAutomatico = { activo: false };

const EVENTOS = ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'keydown', 'keyup', 'touchstart', 'touchmove', 'resize'];

export function Reposo() {
  const invalidate = useThree(state => state.invalidate);
  const clock = useThree(state => state.clock);
  const camera = useThree(state => state.camera);
  const previa = useRef(null);
  useEffect(() => {
    // Al despertar, el reloj descarta la pausa: el primer cuadro no avanza viajes ni fundidos de golpe.
    despertar = () => { clock.getDelta(); invalidate(); };
    const alUsar = () => mantenerActivo(ESPERA_S);
    EVENTOS.forEach(nombre => window.addEventListener(nombre, alUsar, { passive: true }));
    return () => { despertar = () => {}; EVENTOS.forEach(nombre => window.removeEventListener(nombre, alUsar)); };
  }, [invalidate, clock]);
  // Cualquier render de React (cambio de vista, ficha, filtro, textura cargada) reactiva el dibujo.
  useLayoutEffect(() => { mantenerActivo(ESPERA_S); });
  useFrame(() => {
    const { position: p, quaternion: q, fov } = camera;
    const estado = [p.x, p.y, p.z, q.x, q.y, q.z, q.w, fov];
    if (!previa.current || estado.some((v, i) => v !== previa.current[i])) { previa.current = estado; if (!giroAutomatico.activo) mantenerActivo(ESPERA_S); }
    // Mientras la cámara gira sola, el ritmo lo pone el giro (GiroLento.jsx), también para los fundidos.
    if (performance.now() < activoHasta && !giroAutomatico.activo) invalidate();
  });
  return null;
}
