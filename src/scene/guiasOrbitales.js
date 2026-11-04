// Interruptores de las órbitas, la zona habitable y los cúmulos; cada preferencia queda guardada.
import { useSyncExternalStore } from 'react';

function interruptor(clave) {
  let visible = true;
  try { visible = window.localStorage.getItem(clave) !== 'no'; } catch { /* Sin almacenamiento, encendido por defecto. */ }
  const oyentes = new Set();
  const cambiar = valor => {
    visible = valor;
    try { window.localStorage.setItem(clave, valor ? 'si' : 'no'); } catch { /* Sin almacenamiento, la opción dura hasta recargar. */ }
    oyentes.forEach(oyente => oyente());
  };
  const useInterruptor = () => useSyncExternalStore(oyente => { oyentes.add(oyente); return () => oyentes.delete(oyente); }, () => visible, () => true);
  return [useInterruptor, cambiar];
}
export const [useOrbitas, cambiarOrbitas] = interruptor('hoshi-orbitas');
export const [useZonaVisible, cambiarZonaVisible] = interruptor('hoshi-zona-habitable');
export const [useCumulosVisibles, cambiarCumulos] = interruptor('hoshi-cumulos');
