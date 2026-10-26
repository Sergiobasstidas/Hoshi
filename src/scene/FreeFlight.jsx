import { useEffect, useLayoutEffect, useRef } from 'react';
import { Vector3 } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { flightSpeed, wheelSpeed, KM_TO_PC, AU_TO_PC, MAX_FLIGHT_SPEED_PC } from './scale';
import { constrainFlight } from './navigation.js';
import { advanceFlight, FLIGHT_KEYS, isFlightTypingTarget } from './flightMotion';
import { approachSpeed, stopBeforeTarget, STAR_STOP_PC } from './starHeading';
import { stellarStopDistance } from './stellarPhysics';

// Mando táctil: un dedo mira y dos dedos pellizcan para acercarse o alejarse.
const PELLIZCO_SEGUNDOS = 2.5;

export default function FreeFlight({ velocidadSolicitada, onSpeedChange, initialBody, origin, onManualLook, aimTarget, inspectedTarget }) {
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
    motion.current.speed = Math.min(MAX_FLIGHT_SPEED_PC, motion.current.speed);
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
    const toques = new Map();
    let pellizco = null;
    const clear = () => {
      state.advance();
      state.keys.clear();
      toques.clear();
      pellizco = null;
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
    // Considerar pulsaciones breves que empiezan y terminan entre cuadros renderizados.
    const keyup = event => { state.advance(); state.keys.delete(event.code); };
    const separacion = () => {
      const [a, b] = toques.values();
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : null;
    };
    const desplazar = distancia => {
      const start = camera.position.clone();
      camera.translateZ(-distancia);
      if (state.target) stopBeforeTarget(camera, start, state.target, state.stopDistance);
      constrainFlight(camera.position, start, origin);
    };
    const tocar = event => {
      canvas.focus({ preventScroll: true });
      try { canvas.setPointerCapture(event.pointerId); } catch { /* puntero ya liberado */ }
      toques.set(event.pointerId, { x: event.clientX, y: event.clientY });
      pellizco = separacion();
    };
    const moverToque = event => {
      const toque = toques.get(event.pointerId);
      if (!toque) return;
      const dx = event.clientX - toque.x, dy = event.clientY - toque.y;
      toque.x = event.clientX; toque.y = event.clientY;
      if (pellizco) {
        const actual = separacion();
        if (!actual) return;
        state.advance();
        desplazar(state.speed * PELLIZCO_SEGUNDOS * Math.log(actual / pellizco));
        pellizco = actual;
        return;
      }
      if (dx || dy) onManualLook();
      camera.rotateY(-dx * 0.002);
      camera.rotateX(-dy * 0.002);
    };
    const soltarToque = event => {
      const toque = toques.get(event.pointerId);
      if (!toque) return;
      toques.delete(event.pointerId);
      pellizco = separacion();
    };
    const down = event => {
      if (event.pointerType === 'touch') { tocar(event); return; }
      if (event.button !== 0) return;
      canvas.focus({ preventScroll: true });
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
    };
    const move = event => {
      if (event.pointerType === 'touch') { moverToque(event); return; }
      if (!pointer || pointer.id !== event.pointerId) return;
      if (event.clientX !== pointer.x || event.clientY !== pointer.y) onManualLook();
      camera.rotateY(-(event.clientX - pointer.x) * 0.002);
      camera.rotateX(-(event.clientY - pointer.y) * 0.002);
      pointer.x = event.clientX; pointer.y = event.clientY;
    };
    const up = event => {
      if (event.pointerType === 'touch') { soltarToque(event); return; }
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
      // No aplicar movimientos de teclas anteriores tras cambiar el origen local de cámara.
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
  // El dial y la rueda alimentan la misma velocidad, sin mover la cámara.
  useEffect(() => {
    if (!velocidadSolicitada) return;
    motion.current.advance?.();
    motion.current.speed = velocidadSolicitada.valor;
    onSpeedChange(velocidadSolicitada.valor);
  }, [velocidadSolicitada, onSpeedChange]);
  useFrame(() => {
    motion.current.advance?.();
  }, -2);
  return null;
}
