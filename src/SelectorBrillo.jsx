import { useEffect, useState } from 'react';
import { MODOS_BRILLO, elegirModoBrillo, useModoBrillo } from './scene/modosBrillo';
import './selectorBrillo.css';

// Modos de visión. La explicación sale como subtítulo con el puntero y, al elegir, unos segundos,
// para que también funcione en pantallas táctiles.
export default function SelectorBrillo({ viajando }) {
  const modo = useModoBrillo();
  const [encima, setEncima] = useState(null);
  const [recienElegido, setRecienElegido] = useState(false);
  useEffect(() => {
    if (!recienElegido) return undefined;
    const ocultar = () => setRecienElegido(false);
    const fin = setTimeout(ocultar, 2500);
    // Si la persona empieza a moverse, la explicación ya estorba.
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
  }, [recienElegido, modo]);
  const explicado = encima || modo;
  return <>
    <p className={`subtitulo-escena${encima || (recienElegido && !viajando) ? ' visible' : ''}`} role="status">{explicado.texto}</p>
    <div className="selector-brillo" onPointerLeave={() => setEncima(null)}>
      <span>Modo de visión</span>
      <div role="radiogroup" aria-label="Modo de visión">
        {MODOS_BRILLO.map(opcion => <button key={opcion.id} role="radio" aria-checked={modo.id === opcion.id}
          onPointerEnter={event => { if (event.pointerType === 'mouse') setEncima(opcion); }}
          onClick={() => { elegirModoBrillo(opcion.id); setRecienElegido(true); }}>{opcion.nombre}</button>)}
      </div>
    </div>
  </>;
}
