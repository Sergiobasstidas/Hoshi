import { Vector3 } from 'three';

export const FLIGHT_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyF',
  'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const motion = new Vector3();

// Frame-rate independent motion; the wheel never adds translation or rotation.
export function advanceFlight(camera, keys, speed, delta) {
  const axis = (positive, negative) => Number(keys.has(positive)) - Number(keys.has(negative));
  const dt = Math.min(delta, 0.05);
  motion.set(axis('KeyD', 'KeyA'), axis('KeyR', 'KeyF'), axis('KeyS', 'KeyW'));
  if (motion.lengthSq()) camera.position.add(motion.normalize().applyQuaternion(camera.quaternion).multiplyScalar(speed * dt));
  camera.rotateY(axis('ArrowLeft', 'ArrowRight') * 0.3 * dt);
  camera.rotateX(axis('ArrowUp', 'ArrowDown') * 0.3 * dt);
  camera.rotateZ(axis('KeyQ', 'KeyE') * 0.3 * dt);
}

export function isFlightTypingTarget(target) {
  return Boolean(target?.closest?.('input, textarea, select, [contenteditable="true"], [role="textbox"]'));
}
