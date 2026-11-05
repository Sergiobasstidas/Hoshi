import { useEffect, useRef, useState } from 'react';
import FiltrosSol from './FiltrosSol';
import './controlesComputador.css';

// Distancia de cámara de cada escala, tal como se muestra junto a su nombre en «Viajar a».
const DISTANCIAS = { 'Sistema solar': '5 UA', Kuiper: '110 UA', Heliosfera: '1.150 UA', 'Nube de Oort': '7 al', 'Estrellas cercanas': '65 pc', 'Vía Láctea': 'galaxia' };

const CLIC_MAXIMO_PX = 5, ESPERA_DOBLE_CLIC_MS = 250;

function IconoSol() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
}

// Controles de arriba a la derecha en el computador: Vuelo libre, Sol, Viajar a y Mostrar en una cápsula, y
// Exoplanetas aparte. Las acciones son las mismas de la lista del celular (ejecutarAccion).
export default function ControlesComputador({ acciones, vistaId, solApuntado, solEnFoco, onElegir }) {
  const [abierto, setAbierto] = useState(null);
  const caja = useRef(null);
  const boton = useRef(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = event => { if (!caja.current?.contains(event.target)) setAbierto(null); };
    const tecla = event => { if (event.key === 'Escape') { setAbierto(null); boton.current?.focus(); } };
    document.addEventListener('pointerdown', fuera);
    window.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('pointerdown', fuera); window.removeEventListener('keydown', tecla); };
  }, [abierto]);
  // Filtros del Sol: se abren al llegar a él. Un clic fuera o Escape los cierra; arrastrar para girar o usar la rueda, no.
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(solEnFoco);
  const [focoPrevio, setFocoPrevio] = useState(solEnFoco);
  if (focoPrevio !== solEnFoco) { setFocoPrevio(solEnFoco); setFiltrosAbiertos(solEnFoco); }
  const cierreDiferido = useRef(null);
  useEffect(() => () => clearTimeout(cierreDiferido.current), []);
  useEffect(() => {
    if (!filtrosAbiertos || !solEnFoco || abierto) return undefined;
    let inicio = null;
    const bajar = event => { inicio = caja.current?.contains(event.target) ? null : [event.clientX, event.clientY]; };
    const subir = event => {
      if (inicio && Math.hypot(event.clientX - inicio[0], event.clientY - inicio[1]) < CLIC_MAXIMO_PX) setFiltrosAbiertos(false);
      inicio = null;
    };
    const tecla = event => { if (event.key === 'Escape') setFiltrosAbiertos(false); };
    window.addEventListener('pointerdown', bajar, true);
    window.addEventListener('pointerup', subir, true);
    window.addEventListener('keydown', tecla);
    return () => {
      window.removeEventListener('pointerdown', bajar, true);
      window.removeEventListener('pointerup', subir, true);
      window.removeEventListener('keydown', tecla);
    };
  }, [filtrosAbiertos, solEnFoco, abierto]);
  // Con el Sol en foco, el botón alterna los filtros. El cierre espera por si es un doble clic, para que no parpadeen.
  const pulsarSol = () => {
    clearTimeout(cierreDiferido.current);
    if (solEnFoco && filtrosAbiertos && !abierto) cierreDiferido.current = setTimeout(() => setFiltrosAbiertos(false), ESPERA_DOBLE_CLIC_MS);
    else setFiltrosAbiertos(true);
    elegir('volver-sol');
  };
  const irAlSol = () => {
    clearTimeout(cierreDiferido.current);
    setFiltrosAbiertos(true);
    elegir('ir-al-sol');
  };
  const accion = id => acciones.find(item => item.id === id);
  const escalas = acciones.filter(item => DISTANCIAS[item.texto]);
  const vueloLibre = accion('vuelo-libre'), exoplanetas = accion('exoplanetas');
  const heliosferaVisible = !accion('heliosfera').activa, pulsares = accion('pulsares');
  // Cualquier otro botón de los controles cierra el desplegable abierto.
  const elegir = id => { setAbierto(null); onElegir(id); };
  return <nav ref={caja} className="controles-computador" aria-label="Controles de vista">
    <div className="controles-grupo">
      <button className={vueloLibre.activa ? 'encendido' : ''} aria-pressed={vueloLibre.activa} onClick={() => elegir('vuelo-libre')}>
        <span className="controles-punto" aria-hidden="true" />{vueloLibre.texto}
      </button>
      <button className={solApuntado ? 'encendido' : ''} title="Clic: apuntar al Sol · Doble clic: ir al Sol" aria-label="Volver al Sol" aria-pressed={solApuntado} onClick={pulsarSol} onDoubleClick={irAlSol}>
        <IconoSol />Sol
      </button>
      {[['ir', 'Viajar a'], ['mostrar', 'Mostrar']].map(([id, texto]) => <button key={id} ref={abierto === id ? boton : undefined} className={abierto === id ? 'abierto' : ''} aria-expanded={abierto === id} aria-controls="controles-panel" onClick={() => setAbierto(valor => valor === id ? null : id)}>
        {texto} <span className="controles-flecha" aria-hidden="true">▾</span>
      </button>)}
    </div>
    <button className={`controles-exoplanetas${exoplanetas.activa ? ' encendido' : ''}`} aria-pressed={exoplanetas.activa} onClick={() => elegir('exoplanetas')}>
      <span aria-hidden="true">✦</span>{exoplanetas.texto}
    </button>
    {abierto === 'ir' && <div className="controles-panel" id="controles-panel">
      <h3>Escalas</h3>
      {escalas.map(escala => {
        const actual = escala.id === vistaId || escala.activa;
        return <button key={escala.id} className={`controles-fila${actual ? ' actual' : ''}`} aria-current={actual ? 'true' : undefined} onClick={() => elegir(escala.id)}>
          <span>{escala.texto}</span><small>{DISTANCIAS[escala.texto]}</small>
        </button>;
      })}
    </div>}
    {abierto === 'mostrar' && <div className="controles-panel" id="controles-panel">
      <h3>Mostrar</h3>
      {[['heliosfera', 'Heliosfera', heliosferaVisible], ['orbitas', accion('orbitas').texto, accion('orbitas').activa], ['rutas-sondas', accion('rutas-sondas').texto, accion('rutas-sondas').activa], ['zona-habitable', accion('zona-habitable').texto, accion('zona-habitable').activa], ['cumulos', accion('cumulos').texto, accion('cumulos').activa], ['pulsares', pulsares.texto, pulsares.activa]].map(([id, texto, activa]) =>
        <button key={id} className="controles-fila" role="switch" aria-checked={activa} title={accion(id).titulo} onClick={() => onElegir(id)}>
          <span>{texto}</span><i className="controles-interruptor" aria-hidden="true" />
        </button>)}
    </div>}
    {!abierto && solEnFoco && filtrosAbiertos && <FiltrosSol enPanel />}
  </nav>;
}
