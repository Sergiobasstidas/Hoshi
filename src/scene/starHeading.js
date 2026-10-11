import { Quaternion, Vector3 } from 'three';
import { AU_TO_PC } from './scale.js';

// Numerical guard around an unresolved point, not a claimed stellar radius.
// Stars with physical data use their surface radius instead.
export const STAR_STOP_PC = 0.001 * AU_TO_PC;
export const STAR_AIM_SECONDS = 1.25;

export function canAimStar(position, origin) {
  const distance = Math.hypot(position.x + origin[0], position.y + origin[1], position.z + origin[2]);
  return Number.isFinite(distance);
}

// An inspection limit for a luminous marker, not a measured stellar surface.
export function approachSpeed(speed, distance, stopDistance = STAR_STOP_PC) {
  return Math.min(speed, Math.max(distance - stopDistance, stopDistance * 0.1) * 1.5);
}

export function stopBeforeTarget(camera, start, target, stopDistance = STAR_STOP_PC) {
  const offset = start.clone().sub(target), step = camera.position.clone().sub(start);
  const a = step.lengthSq(), b = offset.dot(step);
  const c = offset.lengthSq() - stopDistance ** 2;
  if (!a || b >= 0) return;
  if (c <= 0) { camera.position.copy(start); return; }
  const discriminant = b * b - a * c;
  if (discriminant < 0) return;
  const fraction = (-b - Math.sqrt(discriminant)) / a;
  if (fraction >= 0 && fraction <= 1) camera.position.copy(start).addScaledVector(step, fraction);
}

export function createStarAim(camera, position, origin) {
  const target = new Vector3(...position).sub(new Vector3(...origin));
  return {
    target, elapsed: 0, from: camera.quaternion.clone(), to: new Quaternion(), turn: new Quaternion(),
    forward: new Vector3(0, 0, -1).applyQuaternion(camera.quaternion),
    offset: new Vector3(), previousOffset: target.clone().sub(camera.position),
  };
}

// Changes only orientation. The heading remains fixed through keyboard travel.
export function advanceStarAim(camera, aim, delta) {
  aim.offset.copy(aim.target).sub(camera.position);
  // Release after crossing the destination instead of flipping 180° each frame.
  if (aim.offset.lengthSq() < 1e-24 || aim.offset.dot(aim.previousOffset) <= 0) return false;
  aim.previousOffset.copy(aim.offset);
  aim.offset.normalize();
  aim.elapsed = Math.min(STAR_AIM_SECONDS, aim.elapsed + Math.max(0, delta));
  const t = aim.elapsed / STAR_AIM_SECONDS;
  const eased = t * t * t * (t * (6 * t - 15) + 10);
  aim.turn.setFromUnitVectors(aim.forward, aim.offset);
  aim.to.copy(aim.turn).multiply(aim.from);
  camera.quaternion.slerpQuaternions(aim.from, aim.to, eased);
  camera.updateMatrixWorld();
  return true;
}
