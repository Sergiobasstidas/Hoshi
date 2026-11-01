import { useEffect, useState } from 'react';

// Datos ampliados de las fichas (scripts/process_fichas.js): se cargan una vez, al abrir la primera.
let cargando;
const cargar = () => {
  cargando ||= fetch('/data/fichas.json').then(r => { if (!r.ok) throw Error('fichas'); return r.json(); }).catch(() => { cargando = null; return null; });
  return cargando;
};
export function useFichas() {
  const [fichas, setFichas] = useState(null);
  useEffect(() => {
    let activo = true;
    cargar().then(datos => { if (activo) setFichas(datos); });
    return () => { activo = false; };
  }, []);
  return fichas;
}
