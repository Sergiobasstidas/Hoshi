import { Vector3 } from 'three';

export const FLIGHT_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyF',
  'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const motion = new Vector3(), turn = new Vector3();

// Constantes de tiempo (s) con que el desplazamiento y el giro llegan a su velocidad al apretar una
// tecla y se detienen al soltarla: sin arranques ni frenazos secos.
export const MOVE_EASE_S = 0.35, TURN_EASE_S = 0.25;
const TURN_RATE = 0.3;
// Bajo esta fracción de la velocidad, con la tecla suelta, el movimiento queda en 0 exacto (la escena
// puede volver al reposo del dibujo bajo demanda).
const REST = 1e-3;
export const createFlightInertia = () => ({ move: new Vector3(), turn: new Vector3() });

const ease = (current, target, dt, tau) => {
  const next = current + (target - current) * (1 - Math.exp(-dt / tau));
  return target === 0 && Math.abs(next) < REST ? 0 : next;
};

// Movimiento independiente de la frecuencia de cuadros; la rueda no traslada ni gira. Con `inertia`
// (createFlightInertia) cada eje acelera y frena con suavidad; sin ella responde de inmediato.
export function advanceFlight(camera, keys, speed, delta, inertia = null) {
  const axis = (positive, negative) => Number(keys.has(positive)) - Number(keys.has(negative));
  const dt = Math.min(delta, 0.05);
  motion.set(axis('KeyD', 'KeyA'), axis('KeyR', 'KeyF'), axis('KeyS', 'KeyW'));
  if (motion.lengthSq() > 1) motion.normalize();
  turn.set(axis('ArrowUp', 'ArrowDown'), axis('ArrowLeft', 'ArrowRight'), axis('KeyQ', 'KeyE'));
  if (inertia) {
    inertia.move.set(ease(inertia.move.x, motion.x, dt, MOVE_EASE_S), ease(inertia.move.y, motion.y, dt, MOVE_EASE_S), ease(inertia.move.z, motion.z, dt, MOVE_EASE_S));
    inertia.turn.set(ease(inertia.turn.x, turn.x, dt, TURN_EASE_S), ease(inertia.turn.y, turn.y, dt, TURN_EASE_S), ease(inertia.turn.z, turn.z, dt, TURN_EASE_S));
    motion.copy(inertia.move);
    turn.copy(inertia.turn);
  }
  if (motion.lengthSq()) camera.position.add(motion.applyQuaternion(camera.quaternion).multiplyScalar(speed * dt));
  camera.rotateY(turn.y * TURN_RATE * dt);
  camera.rotateX(turn.x * TURN_RATE * dt);
  camera.rotateZ(turn.z * TURN_RATE * dt);
}

// ¿Sigue moviéndose la cámara por inercia aunque no haya teclas apretadas?
export const flightCoasting = inertia => Boolean(inertia) && (inertia.move.lengthSq() > 0 || inertia.turn.lengthSq() > 0);

export function isFlightTypingTarget(target) {
  return Boolean(target?.closest?.('input, textarea, select, [contenteditable="true"], [role="textbox"], [role="slider"]'));
}
