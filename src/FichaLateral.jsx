import { useEffect, useRef, useState } from 'react';
import { useEsComputador } from './esComputador';
import './fichaEstrella.css';

export function Dato({ etiqueta, valor, secundario, children }) {
  return <div className="ficha-estrella-dato"><dt>{etiqueta}</dt><dd>{children}{valor}{secundario && <small>{secundario}</small>}</dd></div>;
}

const CLAVE_ANCHO = 'hoshi-ancho-ficha';
const ANCHO_MINIMO = 280, FUNDIDO = 69, FRACCION_MAXIMA = 0.45;
const zoomInterfaz = () => Number(getComputedStyle(document.documentElement).getPropertyValue('--zoom-ui')) || 1;
const anchoValido = ancho => Math.max(ANCHO_MINIMO, Math.min(ancho, window.innerWidth / zoomInterfaz() * FRACCION_MAXIMA - FUNDIDO));
function aplicarAncho(ancho) {
  document.documentElement.style.setProperty('--ancho-ficha', `${anchoValido(ancho)}px`);
}

// Franja invisible junto a la columna: arrastrándola cambia su ancho, que queda guardado.
function BordeAjustable() {
  const pedido = useRef(null);
  useEffect(() => {
    try { pedido.current = Number(window.localStorage.getItem(CLAVE_ANCHO)) || null; } catch { /* Sin almacenamiento, el ancho dura hasta recargar. */ }
    const ajustar = () => { if (pedido.current) aplicarAncho(pedido.current); };
    ajustar();
    window.addEventListener('resize', ajustar);
    return () => window.removeEventListener('resize', ajustar);
  }, []);
  const mover = event => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    pedido.current = anchoValido(event.clientX / zoomInterfaz());
    aplicarAncho(pedido.current);
  };
  const soltar = () => {
    try { if (pedido.current) window.localStorage.setItem(CLAVE_ANCHO, String(Math.round(pedido.current))); } catch { /* Sin almacenamiento, el ancho dura hasta recargar. */ }
  };
  return <div className="ficha-estrella-borde" aria-hidden="true" onPointerDown={event => { event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); }}
    onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar} />;
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
  const computador = useEsComputador();
  return <aside className="ficha-estrella" aria-label={etiqueta}>
    <button className="ficha-estrella-cerrar" aria-label="Cerrar información" onClick={onCerrar}>×</button>
    {saliente && <div key={saliente.clave} className={`ficha-estrella-contenido sale-${sentido}`} aria-hidden="true" inert>{saliente.children}</div>}
    <div key={clave} className={`ficha-estrella-contenido${saliente ? ` entra-${sentido}` : ''}`}>{children}</div>
    {computador && <BordeAjustable />}
  </aside>;
}
