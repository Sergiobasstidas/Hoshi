import { useEffect, useLayoutEffect, useRef } from 'react';
import { Vector3 } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { flightSpeed, wheelSpeed, KM_TO_PC, AU_TO_PC } from './scale';
import { constrainFlight } from './navigation.js';
import { advanceFlight, FLIGHT_KEYS, isFlightTypingTarget } from './flightMotion';
import { approachSpeed, stopBeforeTarget, STAR_STOP_PC } from './starHeading';
import { stellarStopDistance } from './stellarPhysics';

export default function FreeFlight({ onSpeedChange, initialBody, origin, onManualLook, aimTarget, inspectedTarget }) {
  const { camera, gl } = useThree();
  const motion = useRef({ keys: new Set(), speed: 0 });
  useLayoutEffect(() => {
    const target = aimTarget || inspectedTarget;
    const body = !target && initialBody?.kind !== 'system' ? initialBody : null;
    const position = target?.position || body?.position;
    motion.current.target = position ? new Vector3(...position).sub(new Vector3(...origin)) : null;
    motion.current.stopDistance = stellarStopDistance(target?.star?.physics)
      ?? (body?.radiusKm ? body.radiusKm * KM_TO_PC * 1.15 : STAR_STOP_PC);
  }, [aimTarget, inspectedTarget, initialBody, origin]);
  useEffect(() => {
    const canvas = gl.domElement;
    const oldTabIndex = canvas.getAttribute('tabindex');
    const oldTouchAction = canvas.style.touchAction;
    canvas.setAttribute('tabindex', '0');
    canvas.style.setProperty('touch-action', 'none');
    const localDistance = initialBody ? Math.hypot(...camera.position.toArray().map((v, i) => v - (initialBody.position[i] - origin[i]))) : null;
    motion.current.speed = initialBody?.kind === 'system' ? Math.max(0.1 * AU_TO_PC, Math.min(localDistance * 0.08, 8 * AU_TO_PC))
      : initialBody ? Math.max((initialBody.radiusKm || 0) * KM_TO_PC, localDistance) * 0.4 : flightSpeed(camera.position.length());
    const state = motion.current;
    let lastTick = performance.now();
    state.advance = () => {
      const now = performance.now();
      const delta = (now - lastTick) / 1000;
      const start = camera.position.clone();
      const speed = state.target ? approachSpeed(state.speed, camera.position.distanceTo(state.target), state.stopDistance) : state.speed;
      advanceFlight(camera, state.keys, speed, delta);
      if (state.target) {
        stopBeforeTarget(camera, start, state.target, state.stopDistance);
      }
      constrainFlight(camera.position, start, origin);
      lastTick = now;
    };
    let pointer = null;
    const clear = () => {
      state.advance();
      state.keys.clear();
      if (pointer && canvas.hasPointerCapture(pointer.id)) canvas.releasePointerCapture(pointer.id);
      pointer = null;
    };
    const keydown = event => {
      if (event.code === 'Escape' && !isFlightTypingTarget(event.target)) {
        onManualLook();
        return;
      }
      if (!FLIGHT_KEYS.has(event.code) || event.altKey || event.metaKey || event.ctrlKey || isFlightTypingTarget(event.target)) return;
      event.preventDefault();
      canvas.focus({ preventScroll: true });
      state.advance();
      if (event.code.startsWith('Arrow') || event.code === 'KeyQ' || event.code === 'KeyE') onManualLook();
      state.keys.add(event.code);
    };
    // Account for short key presses that begin and end between rendered frames.
    const keyup = event => { state.advance(); state.keys.delete(event.code); };
    const down = event => {
      if (event.button !== 0) return;
      canvas.focus({ preventScroll: true });
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
    };
    const move = event => {
      if (!pointer || pointer.id !== event.pointerId) return;
      if (event.clientX !== pointer.x || event.clientY !== pointer.y) onManualLook();
      camera.rotateY(-(event.clientX - pointer.x) * 0.002);
      camera.rotateX(-(event.clientY - pointer.y) * 0.002);
      pointer.x = event.clientX; pointer.y = event.clientY;
    };
    const up = () => {
      if (pointer && canvas.hasPointerCapture(pointer.id)) canvas.releasePointerCapture(pointer.id);
      pointer = null;
    };
    const wheel = event => {
      event.preventDefault();
      canvas.focus({ preventScroll: true });
      state.advance();
      state.speed = wheelSpeed(state.speed, event, canvas.clientHeight);
      onSpeedChange(state.speed);
    };
    const visibility = () => { if (document.hidden) clear(); };
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', visibility);
    canvas.addEventListener('blur', clear);
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', clear);
    canvas.addEventListener('lostpointercapture', up);
    canvas.addEventListener('wheel', wheel, { passive: false });
    canvas.focus({ preventScroll: true });
    onSpeedChange(state.speed);
    return () => {
      // Never apply an old key movement after navigation has rebased the camera.
      state.keys.clear();
      if (pointer && canvas.hasPointerCapture(pointer.id)) canvas.releasePointerCapture(pointer.id);
      pointer = null;
      state.advance = null;
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', visibility);
      canvas.removeEventListener('blur', clear);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', clear);
      canvas.removeEventListener('lostpointercapture', up);
      canvas.removeEventListener('wheel', wheel);
      canvas.style.setProperty('touch-action', oldTouchAction);
      if (oldTabIndex === null) canvas.removeAttribute('tabindex');
      else canvas.setAttribute('tabindex', oldTabIndex);
    };
  }, [camera, gl, onSpeedChange, initialBody, origin, onManualLook]);
  useFrame(() => {
    motion.current.advance?.();
  }, -2);
  return null;
}
