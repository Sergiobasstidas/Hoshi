import { useEffect, useState } from 'react';
import { FILTROS_ESTELARES, cambiarFiltroEstelar, filtroPorId, useFiltroEstelar } from './scene/filtroEstelar';
import { precargarImagenes, sdoTexture } from './scene/sdoSolar';
import './filtrosSol.css';

// Filtros del Sol a la vista mientras es el foco: un clic elige el filtro y lo explica en un subtítulo.
export default function FiltrosSol() {
  const actual = useFiltroEstelar();
  const [explicando, setExplicando] = useState(false);
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
  useEffect(() => {
    if (!explicando) return undefined;
    const ocultar = () => setExplicando(false);
    const fin = setTimeout(ocultar, 2500);
    const enEscena = event => { if (event.target instanceof HTMLCanvasElement) ocultar(); };
    window.addEventListener('pointerdown', enEscena);
    window.addEventListener('wheel', enEscena, { passive: true });
    window.addEventListener('keydown', ocultar);
    return () => {
      clearTimeout(fin);
      window.removeEventListener('pointerdown', enEscena);
      window.removeEventListener('wheel', enEscena);
      window.removeEventListener('keydown', ocultar);
    };
  }, [explicando, actual]);
  return <>
    <p className={`subtitulo-escena${explicando ? ' visible' : ''}`} role="status">{filtroPorId(actual).texto}</p>
    <div className="filtros-sol" role="radiogroup" aria-label="Filtro del Sol">
      {FILTROS_ESTELARES.map(filtro => <button key={filtro.id} role="radio" aria-checked={filtro.id === actual}
        className={`${filtro.id === actual ? 'encendido' : ''}${filtro.id === actual && cargando ? ' cargando' : ''}`} onClick={() => { cambiarFiltroEstelar(filtro.id); setExplicando(true); }}>
        {filtro.id === actual && <span aria-hidden="true" />}{filtro.nombre}{filtro.banda && <small>{filtro.banda}</small>}
      </button>)}
    </div>
  </>;
}
