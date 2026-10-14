import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { ZOOM_DECAY_PER_S, ZOOM_PER_NOTCH, stepZoom } from './inerciaCamara.js';

// Acercamiento con inercia para la vista orbital, como en NASA Eyes: cada giro de la rueda
// da un impulso a la velocidad de acercamiento, que luego frena poco a poco. OrbitControls
// aplica la rueda de golpe; aquí se intercepta antes de que le llegue. Los gestos táctiles
// siguen siendo de OrbitControls.
export default function ZoomSuave({ controlsRef }) {
  const { camera, gl } = useThree();
  const velocity = useRef(0);
  useEffect(() => {
    const element = gl.domElement.parentElement || gl.domElement;
    const wheel = event => {
      if (!controlsRef.current?.enabled) return;
      event.preventDefault();
      event.stopPropagation();
      // Líneas o páginas (deltaMode 1/2) a píxeles aproximados; tope por evento para
      // que un ratón de rueda libre no lance la cámara.
      const delta = event.deltaY * (event.deltaMode === 1 ? 33 : event.deltaMode === 2 ? 400 : 1);
      velocity.current += Math.max(-300, Math.min(300, delta)) / 100 * ZOOM_PER_NOTCH * ZOOM_DECAY_PER_S;
    };
    element.addEventListener('wheel', wheel, { capture: true, passive: false });
    return () => element.removeEventListener('wheel', wheel, { capture: true });
  }, [gl, controlsRef]);
  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls || Math.abs(velocity.current) < 1e-4) { velocity.current = 0; return; }
    const step = stepZoom(velocity.current, Math.min(delta, 0.1));
    velocity.current = step.velocity;
    const offset = camera.position.clone().sub(controls.target);
    const distance = offset.length();
    const next = Math.max(controls.minDistance, Math.min(controls.maxDistance, distance * step.factor));
    // Al tocar un límite se detiene la inercia en vez de empujar contra él.
    if (next !== distance * step.factor) velocity.current = 0;
    camera.position.copy(controls.target).addScaledVector(offset, next / distance);
  });
  return null;
}
