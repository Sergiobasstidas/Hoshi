import { useEffect, useState } from 'react';
import { FILTROS_ESTELARES, cambiarFiltroEstelar, filtroPorId, useFiltroEstelar } from './scene/filtroEstelar';
import { precargarImagenes, sdoTexture } from './scene/sdoSolar';
import './filtrosSol.css';

// Filtros del Sol a la vista mientras es el foco. En el computador van en el panel de los controles,
// con su explicación; en el celular, en una fila de chips junto al rótulo de CreditoSDO.
export default function FiltrosSol({ enPanel = false }) {
  const actual = useFiltroEstelar();
  const [cargando, setCargando] = useState(false);
  useEffect(precargarImagenes, []);
  // Indicador en el botón elegido mientras su imagen o su vídeo no están listos.
  useEffect(() => {
    const { canal } = filtroPorId(actual);
    const revisar = () => { const textura = canal && sdoTexture(canal); setCargando(Boolean(textura) && !(textura.ready && (!textura.element || textura.playing))); };
    revisar();
    const reloj = setInterval(revisar, 300);
    return () => clearInterval(reloj);
  }, [actual]);
  if (enPanel) {
    const { banda, canal, nombre, texto } = filtroPorId(actual);
    return <div className="controles-panel" role="radiogroup" aria-label="Filtro del Sol">
      <h3>Filtros del Sol</h3>
      {FILTROS_ESTELARES.map(filtro => <button key={filtro.id} role="radio" aria-checked={filtro.id === actual}
        className={`controles-fila${filtro.id === actual ? ' actual' : ''}${filtro.id === actual && cargando ? ' cargando' : ''}`} onClick={() => cambiarFiltroEstelar(filtro.id)}>
        <span>{filtro.nombre}</span>{filtro.banda && <small>{filtro.banda}</small>}
      </button>)}
      <div className="controles-explicacion" role="status">
        <strong>{nombre}{banda ? ` · ${banda}` : ''}</strong>
        <p>{texto}</p>
        {canal && <p>La cara oculta es un reflejo en espejo de la visible, no una observación</p>}
      </div>
    </div>;
  }
  return <div className="filtros-sol" role="radiogroup" aria-label="Filtro del Sol">
    {FILTROS_ESTELARES.map(filtro => <button key={filtro.id} role="radio" aria-checked={filtro.id === actual}
      className={`${filtro.id === actual ? 'encendido' : ''}${filtro.id === actual && cargando ? ' cargando' : ''}`} onClick={() => cambiarFiltroEstelar(filtro.id)}>
      {filtro.id === actual && <span aria-hidden="true" />}{filtro.nombre}{filtro.banda && <small>{filtro.banda}</small>}
    </button>)}
  </div>;
}
