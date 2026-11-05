import { useSyncExternalStore } from 'react';

// Animación de un sobrevuelo (botón ▶ de su ficha, LineaTiempoSonda.jsx): el tiempo corre de
// WINDOW_DAYS antes a WINDOW_DAYS después del máximo acercamiento en DURATION_S segundos; el planeta
// avanza por su trayectoria real y la sonda por su ruta (ProbeTrails.jsx). La cámara no se mueve.
export const WINDOW_DAYS = 3, DURATION_S = 12;
// `key`: «código:planeta» del sobrevuelo; `t`: día juliano mostrado; `playing`: corre o está en pausa.
let state = { key: null, closestJd: null, t: null, playing: false };
const listeners = new Set();
const emit = next => { state = next; listeners.forEach(listener => listener()); };
export const flybyKey = (code, planet) => `${code}:${planet}`;
export const playback = () => state;
export function playFlyby(key, closestJd) {
  if (state.key === key && state.t !== null) { emit({ ...state, playing: !state.playing }); return; }
  emit({ key, closestJd, t: closestJd - WINDOW_DAYS, playing: true });
}
export const stopFlyby = () => { if (state.key) emit({ key: null, closestJd: null, t: null, playing: false }); };
// Avanza `delta` segundos de animación; al terminar vuelve al estado de la etapa.
export function advanceFlyby(delta) {
  if (!state.playing) return;
  const t = state.t + delta * 2 * WINDOW_DAYS / DURATION_S;
  if (t >= state.closestJd + WINDOW_DAYS) { stopFlyby(); return; }
  emit({ ...state, t });
}
const subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener); };
export const useFlybyPlayback = () => useSyncExternalStore(subscribe, () => state, () => state);
