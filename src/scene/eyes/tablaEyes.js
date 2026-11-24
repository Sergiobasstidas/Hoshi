import { useEffect, useState } from 'react';

// Tabla de cada exoplaneta: su aspecto de Eyes on Exoplanets y el tipo que muestra su ficha (public/data/exoplanetas-eyes.json,
// scripts/exoplanets/build_eyes.js). Se pide la primera vez que hace falta: al acercarse a un planeta o al abrir su ficha.
let pedido = null;
export const cargarTablaEyes = () => (pedido ??= fetch('/data/exoplanetas-eyes.json').then(r => { if (!r.ok) throw Error('eyes'); return r.json(); })
  .catch(() => { pedido = null; return { c: [], p: {} }; }));
// [aspecto, tipo de ficha] del planeta, o null.
export const parDe = (tabla, nombre) => tabla?.c[tabla.p[nombre]] || null;

// Tipo de planeta para la ficha (null mientras se carga o si no lo tiene).
export function useTipoFicha(nombre) {
  const [tabla, setTabla] = useState(null);
  useEffect(() => {
    let vigente = true;
    cargarTablaEyes().then(t => { if (vigente) setTabla(t); });
    return () => { vigente = false; };
  }, []);
  return parDe(tabla, nombre)?.[1] || null;
}
