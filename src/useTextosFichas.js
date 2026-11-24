import { useEffect, useState } from 'react';

// Textos propios de las fichas (public/data/textos-fichas.json): se cargan una vez, al abrir la primera ficha, para que
// no pesen en la carga inicial. Mientras cargan, el hook devuelve undefined (la ficha espera para no cambiar el texto al
// llegar); si fallan, un objeto vacío, y cada ficha usa su texto genérico.
const VACIO = { estrellas: {}, planetas: {}, cumulos: {}, sistemaSolar: {} };
let cargando, cargados;
const cargar = () => {
  cargando ||= fetch('/data/textos-fichas.json').then(r => { if (!r.ok) throw Error('textos'); return r.json(); })
    .then(datos => (cargados = { ...VACIO, ...datos }))
    .catch(() => { cargando = null; return VACIO; });
  return cargando;
};
export function useTextosFichas() {
  const [textos, setTextos] = useState(cargados);
  useEffect(() => {
    if (cargados) return undefined;
    let activo = true;
    cargar().then(datos => { if (activo) setTextos(datos); });
    return () => { activo = false; };
  }, []);
  return textos;
}
