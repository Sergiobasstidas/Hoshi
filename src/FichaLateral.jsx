import { useEffect, useRef, useState } from 'react';
import './fichaEstrella.css';

export function Dato({ etiqueta, valor, secundario, children }) {
  return <div className="ficha-estrella-dato"><dt>{etiqueta}</dt><dd>{children}{valor}{secundario && <small>{secundario}</small>}</dd></div>;
}

// Columna de información a todo el alto. Al cambiar de `clave` la página anterior se desliza
// hacia un lado y entra la nueva, como al pasar la hoja (`direccion`: 1 adelante, −1 atrás).
export default function FichaLateral({ clave, direccion = 1, etiqueta, onCerrar, children }) {
  const [saliente, setSaliente] = useState(null);
  const anterior = useRef({ clave, children });
  useEffect(() => {
    if (anterior.current.clave !== clave) {
      setSaliente({ clave: anterior.current.clave, children: anterior.current.children });
      const fin = setTimeout(() => setSaliente(null), 300);
      anterior.current = { clave, children };
      return () => clearTimeout(fin);
    }
    anterior.current = { clave, children };
    return undefined;
  }, [clave, children]);
  useEffect(() => {
    const tecla = event => { if (event.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCerrar]);
  const sentido = direccion < 0 ? 'atras' : 'adelante';
  return <aside className="ficha-estrella" aria-label={etiqueta}>
    <button className="ficha-estrella-cerrar" aria-label="Cerrar información" onClick={onCerrar}>×</button>
    {saliente && <div key={saliente.clave} className={`ficha-estrella-contenido sale-${sentido}`} aria-hidden="true" inert>{saliente.children}</div>}
    <div key={clave} className={`ficha-estrella-contenido${saliente ? ` entra-${sentido}` : ''}`}>{children}</div>
  </aside>;
}
