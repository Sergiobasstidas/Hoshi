// Modos de visión de las estrellas. «Mapa» es el comportamiento de siempre; los demás usan el
// brillo real desde la cámara, con la magnitud más débil que alcanza cada instrumento.
import { useSyncExternalStore } from 'react';

export const MODOS_BRILLO = [
  { id: 'mapa', nombre: 'Mapa', texto: 'Todas las estrellas del catálogo, para orientarte. No es lo que verías a simple vista.' },
  { id: 'ojo', nombre: 'Ojo humano', limite: 6, texto: 'Lo que verías a simple vista desde aquí. Lejos de todo, casi nada.' },
  { id: 'binoculares', nombre: 'Binoculares', limite: 9, texto: 'Como con binoculares: aparecen miles de estrellas que el ojo no alcanza.' },
];
// Sin nada guardado se parte en «Ojo humano» (pedido de Sergio, 07/11/2026); la clave cambió para que
// también parta así un navegador que tenía otro modo guardado.
const CLAVE = 'hoshi-cielo-3', INICIAL = 'ojo';
const leerGuardado = () => {
  try { return window.localStorage.getItem(CLAVE); } catch { return null; }
};
let actual = MODOS_BRILLO.find(modo => modo.id === (typeof window === 'undefined' ? null : leerGuardado())) || MODOS_BRILLO.find(modo => modo.id === INICIAL);
const oyentes = new Set();
export function elegirModoBrillo(id) {
  actual = MODOS_BRILLO.find(modo => modo.id === id);
  try { window.localStorage.setItem(CLAVE, id); } catch { /* Sin almacenamiento, el modo dura hasta recargar. */ }
  oyentes.forEach(oyente => oyente());
}
export const useModoBrillo = () => useSyncExternalStore(oyente => { oyentes.add(oyente); return () => oyentes.delete(oyente); }, () => actual);

// Uniformes del modo: `fisico` activa el brillo real y `limite` es la magnitud apenas visible.
export const parametrosBrillo = () => ({ fisico: actual.limite ? 1 : 0, limite: actual.limite ?? 6 });

// Cuánto se ve el nombre de una estrella (0–1) en un modo con límite: la misma magnitud aparente que usa
// StarField.jsx desde la cámara, con medio punto de transición alrededor del límite.
export function nombreVisible(magnitudAbsoluta, distanciaPc, limite) {
  const aparente = magnitudAbsoluta + 5 * Math.log10(Math.max(distanciaPc, 1e-6) / 10);
  const x = Math.min(Math.max((limite - aparente + 0.5) / 1, 0), 1);
  return x * x * (3 - 2 * x);
}
