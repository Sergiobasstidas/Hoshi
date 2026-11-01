import { useEffect, useState } from 'react';

// Pantalla completa, como al ver una película: el navegador oculta sus barras y Hoshi ocupa toda
// la pantalla. Esc o el mismo botón la cierran. Se oculta donde el navegador no la permite (iPhone).
const raiz = () => document.documentElement;
const enPantallaCompleta = () => Boolean(document.fullscreenElement || document.webkitFullscreenElement);
const disponible = () => typeof document !== 'undefined' && Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled);

export default function PantallaCompleta() {
  const [activa, setActiva] = useState(enPantallaCompleta);
  useEffect(() => {
    const cambio = () => setActiva(enPantallaCompleta());
    document.addEventListener('fullscreenchange', cambio);
    document.addEventListener('webkitfullscreenchange', cambio);
    return () => { document.removeEventListener('fullscreenchange', cambio); document.removeEventListener('webkitfullscreenchange', cambio); };
  }, []);
  if (!disponible()) return null;
  const alternar = () => {
    if (enPantallaCompleta()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else (raiz().requestFullscreen || raiz().webkitRequestFullscreen).call(raiz())?.catch?.(() => {});
  };
  const texto = activa ? 'Salir de pantalla completa' : 'Pantalla completa';
  return <button className="pantalla-completa" aria-pressed={activa} aria-label={texto} title={texto} onClick={alternar}>
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      {activa
        ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
        : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
    </svg>
  </button>;
}
