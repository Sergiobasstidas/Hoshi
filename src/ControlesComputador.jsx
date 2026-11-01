import { useEffect, useRef, useState } from 'react';
import './controlesComputador.css';

// Distancia de cámara de cada escala, tal como se muestra junto a su nombre en «Ver».
const DISTANCIAS = { 'Sistema solar': '5 UA', Kuiper: '110 UA', Heliosfera: '1.150 UA', 'Nube de Oort': '7 al', 'Estrellas cercanas': '65 pc', 'Vía Láctea': 'galaxia' };

function IconoSol() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
}

// Controles de arriba a la derecha en el computador: Vuelo libre, Sol y Ver en una cápsula, y
// Exoplanetas aparte. Las acciones son las mismas de la lista del celular (ejecutarAccion).
export default function ControlesComputador({ acciones, vistaId, solApuntado, onElegir }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef(null);
  const boton = useRef(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = event => { if (!caja.current?.contains(event.target)) setAbierto(false); };
    const tecla = event => { if (event.key === 'Escape') { setAbierto(false); boton.current?.focus(); } };
    document.addEventListener('pointerdown', fuera);
    window.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('pointerdown', fuera); window.removeEventListener('keydown', tecla); };
  }, [abierto]);
  const accion = id => acciones.find(item => item.id === id);
  const escalas = acciones.filter(item => DISTANCIAS[item.texto]);
  const vueloLibre = accion('vuelo-libre'), exoplanetas = accion('exoplanetas');
  const heliosferaVisible = !accion('heliosfera').activa, pulsares = accion('pulsares');
  const elegirEscala = id => { setAbierto(false); onElegir(id); };
  return <nav className="controles-computador" aria-label="Controles de vista">
    <div ref={caja} className="controles-grupo">
      <button className={vueloLibre.activa ? 'encendido' : ''} aria-pressed={vueloLibre.activa} onClick={() => onElegir('vuelo-libre')}>
        <span className="controles-punto" aria-hidden="true" />{vueloLibre.texto}
      </button>
      <button className={solApuntado ? 'encendido' : ''} title="Volver al Sol" aria-label="Volver al Sol" aria-pressed={solApuntado} onClick={() => onElegir('volver-sol')}>
        <IconoSol />Sol
      </button>
      <button ref={boton} className={abierto ? 'abierto' : ''} aria-expanded={abierto} aria-controls="controles-ver" onClick={() => setAbierto(valor => !valor)}>
        Ver <span className="controles-flecha" aria-hidden="true">▾</span>
      </button>
      {abierto && <div className="controles-ver" id="controles-ver">
        <h3>Ir a</h3>
        {escalas.map(escala => {
          const actual = escala.id === vistaId || escala.activa;
          return <button key={escala.id} className={`controles-fila${actual ? ' actual' : ''}`} aria-current={actual ? 'true' : undefined} onClick={() => elegirEscala(escala.id)}>
            <span>{escala.texto}</span><small>{DISTANCIAS[escala.texto]}</small>
          </button>;
        })}
        <h3>Mostrar</h3>
        <button className="controles-fila" role="switch" aria-checked={heliosferaVisible} title={accion('heliosfera').titulo} onClick={() => onElegir('heliosfera')}>
          <span>Heliosfera</span><i className="controles-interruptor" aria-hidden="true" />
        </button>
        <button className="controles-fila" role="switch" aria-checked={pulsares.activa} onClick={() => onElegir('pulsares')}>
          <span>{pulsares.texto}</span><i className="controles-interruptor" aria-hidden="true" />
        </button>
      </div>}
    </div>
    <button className={`controles-exoplanetas${exoplanetas.activa ? ' encendido' : ''}`} aria-pressed={exoplanetas.activa} onClick={() => onElegir('exoplanetas')}>
      <span aria-hidden="true">✦</span>{exoplanetas.texto}
    </button>
  </nav>;
}
