import { useSyncExternalStore } from 'react';

// Mismo límite que controlesComputador.css: desde aquí mandan el buscador central y el grupo de la derecha.
const CONSULTA = '(min-width: 901px) and (min-height: 501px)';
const medios = typeof window !== 'undefined' ? window.matchMedia?.(CONSULTA) : null;
const suscribir = aviso => {
  medios?.addEventListener('change', aviso);
  return () => medios?.removeEventListener('change', aviso);
};

export function useEsComputador() {
  return useSyncExternalStore(suscribir, () => Boolean(medios?.matches), () => false);
}
