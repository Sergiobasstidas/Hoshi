import { useEffect, useRef, useState } from 'react';
import './fichaEstrella.css';

// Fila de la zona habitable: se pulsa para dibujarla en el sistema.
export function FilaZona({ zona, activa, onAlternar, nota }) {
  return <button className={`ficha-estrella-zona${activa ? ' activa' : ''}`} aria-pressed={activa} onClick={onAlternar}>
    <span>Zona habitable</span>
    <b>{zona.interior.toLocaleString('es-CL', { maximumSignificantDigits: 2 })}–{zona.exterior.toLocaleString('es-CL', { maximumSignificantDigits: 2 })} UA<small>{nota}</small>
      {activa && <small>Claro: zona segura · Oscuro: límite posible</small>}</b>
  </button>;
}

export function Dato({ etiqueta, valor, secundario, children }) {
  return <div className="ficha-estrella-dato"><dt>{etiqueta}</dt><dd>{children}{valor}{secundario && <small>{secundario}</small>}</dd></div>;
}

// Columna de información a todo el alto. Al cambiar de `clave` la página anterior se desliza
// hacia un lado y entra la nueva, como al pasar la hoja (`direccion`: 1 adelante, −1 atrás).
export default function FichaLateral({ clave, direccion = 1, etiqueta, onCerrar, children }) {
  const [saliente, setSaliente] = useState(null);
  const anterior = useRef({ clave, children });
  useEffect(() => {
    if (anterior.current.clave !== clave) setSaliente({ clave: anterior.current.clave, children: anterior.current.children });
    anterior.current = { clave, children };
  }, [clave, children]);
  useEffect(() => {
    if (!saliente) return undefined;
    const fin = setTimeout(() => setSaliente(null), 300);
    return () => clearTimeout(fin);
  }, [saliente]);
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
