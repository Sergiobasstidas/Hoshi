import { useSyncExternalStore } from 'react';

// Títulos de las estrellas (id → el nombre más conocido, el primero del buscador) para nombreEstrella
// (nombresEstrella.js). Al cargar llegan los de las anfitrionas de planetas y las estrellas de sistemas múltiples
// (public/data/titulos.json, scripts/build_titulos.js); cuando se carga el índice del buscador, los de todas.
const mapa = new Map();
// Nombre para las compañeras sin registro propio cuando el título es un nombre propio (Copernicus → 55 Cnc).
const bases = new Map();
export const basesCompaneras = () => bases;
let version = 0;
const oyentes = new Set();
export const titulosEstrellas = () => mapa;
export function sumarTitulos(entradas) {
  let nuevos = 0;
  for (const [id, titulo] of entradas) if (titulo && !/^(AT-HYG|HSB) / .test(titulo) && !mapa.has(id)) { mapa.set(id, titulo); nuevos++; }
  if (!nuevos) return;
  version++;
  oyentes.forEach(oyente => oyente());
}
const suscribir = oyente => { oyentes.add(oyente); return () => oyentes.delete(oyente); };
// Para volver a dibujar cuando llegan títulos nuevos: devuelve el mapa y su versión.
export function useTitulos() {
  const v = useSyncExternalStore(suscribir, () => version);
  return { titulos: mapa, version: v };
}
