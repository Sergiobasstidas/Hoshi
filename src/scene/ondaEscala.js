// © 2026 Sergio Bastidas Acosta. Onda compacta: tres líneas a cada lado del centro.
export const CANTIDAD_LINEAS_ESCALA = 65;

export function intensidadLinea(indice, vista) {
  if (vista === null) return 0;
  const centro = (100 - vista) * (CANTIDAD_LINEAS_ESCALA - 1) / 100;
  const distancia = Math.abs(indice - centro);
  if (distancia >= 3.5) return 0;
  return Math.cos(distancia * Math.PI / 7) ** 2;
}
