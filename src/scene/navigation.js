import { MathUtils, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { BODY_CAMERA_NEAR_PC, MAX_VIEW_DISTANCE_PC, LIGHT_YEAR_PC } from './scale.js';
import { PULSARS } from './pulsarData.js';
import { JOURNEY_SECONDS, JOURNEY_ACCELERATION, journeyDistance, journeyProgress } from './starJourney.js';

export function beginJourney(camera, view, origin) {
  const target = new Vector3(...view.target).sub(new Vector3(...origin));
  camera.position.fromArray(view.journey.start).sub(new Vector3(...origin));
  camera.quaternion.fromArray(view.journey.rotation);
  const offset = camera.position.clone().sub(target);
  const startDirection = offset.clone().normalize();
  if (!startDirection.lengthSq()) startDirection.set(0, 0, 1);
  const endDirection = view.direction ? new Vector3(...view.direction).normalize() : startDirection;
  return {
    elapsed: 0, target, startDirection,
    arc: new Quaternion().setFromUnitVectors(startDirection, endDirection),
    startDistance: Math.max(offset.length(), BODY_CAMERA_NEAR_PC),
    rotation: camera.quaternion.clone(),
    duration: view.journey.headingOnly ? 1.25 : (view.journey.duration ?? JOURNEY_SECONDS),
    headingOnly: view.journey.headingOnly, startFov: camera.fov,
  };
}

export function advanceJourney(camera, transition, view, endFov, delta) {
  transition.elapsed = Math.min(transition.duration, transition.elapsed + Math.min(delta, 0.05));
  const t = transition.elapsed / transition.duration;
  const ease = transition.headingOnly ? t * t * t * (t * (6 * t - 15) + 10) : journeyProgress(t);
  if (!transition.headingOnly) {
    const distance = journeyDistance(transition.startDistance, view.distance, t);
    const arc = new Quaternion().slerp(transition.arc, ease);
    camera.position.copy(transition.startDirection).applyQuaternion(arc).multiplyScalar(distance).add(transition.target);
  }
  camera.lookAt(transition.target);
  const endRotation = camera.quaternion.clone();
  camera.quaternion.slerpQuaternions(transition.rotation, endRotation,
    transition.headingOnly ? ease : MathUtils.smoothstep(t, 0, JOURNEY_ACCELERATION));
  camera.fov = MathUtils.lerp(transition.startFov, endFov, ease);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return t === 1;
}

export const PULSAR_VIEW_DIRECTION = new Vector3(-0.839, -0.3995, 0.3695).normalize().toArray();
export const PULSAR_VIEW_DISTANCE_PC = 25000 * LIGHT_YEAR_PC;
export const PULSAR_VIEW = { id: 'pulsars', distance: PULSAR_VIEW_DISTANCE_PC, target: [0, 0, 0], direction: PULSAR_VIEW_DIRECTION };

// Encuadrar los extremos 3D reales cambiando la lente, nunca sus coordenadas ni
// el límite compartido. Dejar margen para controles y nombres en los bordes.
export function pulsarFieldOfView(aspect) {
  const camera = new PerspectiveCamera();
  camera.up.set(0, -Math.sin(23.43928 * Math.PI / 180), Math.cos(23.43928 * Math.PI / 180));
  camera.position.fromArray(PULSAR_VIEW_DIRECTION).multiplyScalar(PULSAR_VIEW_DISTANCE_PC);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  let tangent = Math.tan(25 * Math.PI / 180);
  for (const pulsar of PULSARS) {
    const p = new Vector3(...pulsar.position).applyMatrix4(camera.matrixWorldInverse);
    tangent = Math.max(tangent, Math.abs(p.y) / (-p.z * 0.65), Math.abs(p.x) / (-p.z * Math.max(aspect, 0.1) * 0.86));
  }
  return 2 * Math.atan(tangent) * 180 / Math.PI;
}

// Usar coordenadas solares globales incluso tras trasladar el origen a otra estrella.
// Una posición anterior fuera del límite puede regresar sin saltos.
export function constrainFlight(position, previous, origin) {
  const offset = new Vector3(...origin);
  const world = position.clone().add(offset);
  const previousRadius = previous.clone().add(offset).length();
  const limit = Math.max(MAX_VIEW_DISTANCE_PC, previousRadius);
  if (world.length() > limit) position.copy(world.setLength(limit).sub(offset));
}
