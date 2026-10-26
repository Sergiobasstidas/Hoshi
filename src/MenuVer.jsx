import { useEffect, useRef, useState } from 'react';

// Lista «Ver» del computador: las escalas y modos se despliegan hacia la izquierda del botón,
// en fila, para no tapar la escala lateral que está debajo.
export default function MenuVer({ acciones, onElegir }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = event => { if (!caja.current?.contains(event.target)) setAbierto(false); };
    const tecla = event => { if (event.key === 'Escape') setAbierto(false); };
    document.addEventListener('pointerdown', fuera);
    window.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('pointerdown', fuera); window.removeEventListener('keydown', tecla); };
  }, [abierto]);
  return <div ref={caja} className={`menu-ver${abierto ? ' abierto' : ''}`}>
    <div className="menu-ver-opciones" id="menu-ver-opciones" inert={!abierto}>
      {acciones.map((accion, indice) => <button key={accion.id} aria-pressed={accion.activa} title={accion.titulo}
        style={{ '--retardo': `${(acciones.length - 1 - indice) * 25}ms` }}
        onClick={() => { setAbierto(false); onElegir(accion.id); }}>{accion.texto}</button>)}
    </div>
    <button className="menu-ver-boton" aria-expanded={abierto} aria-controls="menu-ver-opciones" onClick={() => setAbierto(valor => !valor)}>
      Ver <span aria-hidden="true">‹</span>
    </button>
  </div>;
}
