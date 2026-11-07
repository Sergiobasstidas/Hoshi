import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { giroAutomatico, mantenerActivo } from './reposo';
import { playback } from './flybyPlayback';
import { FLIGHT_KEYS } from './flightMotion';

// Al llegar a un destino de «Viajar a», la cámara lo ronda sola, muy lento, para verlo en
// perspectiva mientras se lee su ficha (pedido de Sergio, 07/11/2026). Gira alrededor de la vertical
// de la cámara, así conserva la elevación. Empieza al llegar, acelerando en GIRO_ARRANQUE_S.
// Solo la detiene lo que mueve la cámara (arrastrar la escena, la rueda sobre ella o las teclas de
// movimiento, con la rueda en cualquier parte); vuelve tras GIRO_ESPERA_S sin eso. El giro solo cambia el
// ángulo alrededor del objetivo, nunca la distancia. Mover el ratón o usar paneles y botones no la pausa.
// Mientras gira, la escena se dibuja a GIRO_CUADROS_POR_S y no a la frecuencia de la pantalla; para
// eso OrbitControls queda en pausa (con cada cambio pedía otro cuadro) y vuelve al tocar la escena.
export const GIRO_VUELTA_S = 235, GIRO_ESPERA_S = 8, GIRO_ARRANQUE_S = 1, GIRO_CUADROS_POR_S = 30;
const ARRASTRE_PX = 3;
const suave = x => x * x * (3 - 2 * x);
const eje = new Vector3();

export default function GiroLento({ controlsRef }) {
  const { camera, gl, invalidate } = useThree();
  // Momento del último movimiento de cámara del usuario; al montarse (al llegar), el giro arranca ya.
  const tocado = useRef(0);
  const presion = useRef(null);
  const ultimo = useRef(0);
  useEffect(() => {
    const ahora = () => performance.now();
    tocado.current = ahora() - GIRO_ESPERA_S * 1000;
    const canvas = gl.domElement;
    const enEscena = event => canvas.contains(event.target) || event.target === canvas.parentElement;
    const despertarControles = () => { if (controlsRef.current) controlsRef.current.enabled = true; };
    // Al tocar, el giro se detiene en el acto y el dibujo vuelve a cuadros completos enseguida: si no, el
    // acercamiento de la rueda esperaba al siguiente cuadro y llegaba de golpe.
    const tocar = () => { tocado.current = ahora(); giroAutomatico.activo = false; despertarControles(); mantenerActivo(); invalidate(); };
    const bajar = event => {
      if (!enEscena(event)) return;
      // Los controles vuelven antes de que les llegue el evento, para que el arrastre funcione.
      presion.current = [event.clientX, event.clientY];
      despertarControles();
    };
    const mover = event => {
      const inicio = presion.current;
      if (inicio && Math.hypot(event.clientX - inicio[0], event.clientY - inicio[1]) > ARRASTRE_PX) tocar();
    };
    const soltar = () => { presion.current = null; };
    const tecla = event => { if (FLIGHT_KEYS.has(event.code)) tocar(); };
    const opciones = { passive: true, capture: true };
    const escuchas = [['pointerdown', bajar], ['pointermove', mover], ['pointerup', soltar], ['pointercancel', soltar],
      ['wheel', tocar], ['keydown', tecla]];
    escuchas.forEach(([nombre, escucha]) => window.addEventListener(nombre, escucha, opciones));
    // Cuadros a ritmo fijo mientras gira; el resto del tiempo manda el reposo del dibujo.
    const reloj = setInterval(() => { if (giroAutomatico.activo || ahora() - tocado.current >= GIRO_ESPERA_S * 1000) invalidate(); },
      1000 / GIRO_CUADROS_POR_S);
    return () => {
      escuchas.forEach(([nombre, escucha]) => window.removeEventListener(nombre, escucha, opciones));
      clearInterval(reloj);
      giroAutomatico.activo = false;
      despertarControles();
    };
  }, [gl, controlsRef, invalidate]);
  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const ahora = performance.now();
    const segundos = (ahora - tocado.current) / 1000 - GIRO_ESPERA_S;
    const activo = segundos > 0 && !presion.current && playback().t === null;
    giroAutomatico.activo = activo;
    controls.enabled = !activo;
    const dt = Math.min((ahora - ultimo.current) / 1000, 0.1);
    ultimo.current = ahora;
    if (!activo) return;
    const ritmo = suave(Math.min(segundos / GIRO_ARRANQUE_S, 1));
    const angulo = 2 * Math.PI / GIRO_VUELTA_S * ritmo * dt;
    camera.position.sub(controls.target).applyAxisAngle(eje.copy(camera.up).normalize(), angulo).add(controls.target);
    camera.lookAt(controls.target);
  });
  return null;
}
