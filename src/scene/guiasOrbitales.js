// Interruptores de las órbitas, la zona habitable, los cúmulos y las rutas de las sondas; cada
// preferencia queda guardada.
import { useSyncExternalStore } from 'react';

function interruptor(clave, porDefecto = true) {
  let visible = porDefecto;
  try { const guardado = window.localStorage.getItem(clave); if (guardado) visible = guardado === 'si'; } catch { /* Sin almacenamiento, el valor por defecto. */ }
  const oyentes = new Set();
  const cambiar = valor => {
    visible = valor;
    try { window.localStorage.setItem(clave, valor ? 'si' : 'no'); } catch { /* Sin almacenamiento, la opción dura hasta recargar. */ }
    oyentes.forEach(oyente => oyente());
  };
  const useInterruptor = () => useSyncExternalStore(oyente => { oyentes.add(oyente); return () => oyentes.delete(oyente); }, () => visible, () => porDefecto);
  return [useInterruptor, cambiar];
}
export const [useOrbitas, cambiarOrbitas] = interruptor('hoshi-orbitas');
export const [useZonaVisible, cambiarZonaVisible] = interruptor('hoshi-zona-habitable');
// Los cúmulos vienen apagados (pedido de Sergio, 06/11/2026); clave nueva para que valga también
// donde quedó guardado el valor anterior.
export const [useCumulosVisibles, cambiarCumulos] = interruptor('hoshi-cumulos-2', false);
// Las rutas completas de las sondas vienen apagadas.
export const [useRutasSondas, cambiarRutasSondas] = interruptor('hoshi-rutas-sondas', false);
