import { useEffect, useState } from 'react';

// Tipos revisados de las fichas (scripts/catalog/build_tipos_revisados.js): se cargan una vez, al abrir la primera.
// Mientras cargan, el hook devuelve undefined (la ficha espera para no cambiar la línea de tipo); si fallan, null.
let cargando, cargados;
const cargar = () => {
  cargando ||= fetch('/data/tipos-revisados.json').then(r => { if (!r.ok) throw Error('tipos'); return r.json(); })
    .then(datos => (cargados = { estrellas: datos.estrellas, neutras: new Set(datos.neutras) }))
    .catch(() => { cargando = null; return null; });
  return cargando;
};
export function useTiposRevisados() {
  const [tipos, setTipos] = useState(cargados);
  useEffect(() => {
    if (cargados) return undefined;
    let activo = true;
    cargar().then(datos => { if (activo) setTipos(datos); });
    return () => { activo = false; };
  }, []);
  return tipos;
}
