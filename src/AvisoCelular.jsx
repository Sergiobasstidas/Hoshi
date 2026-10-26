import { useEffect, useState } from 'react';

// Aviso en el celular: aparece cada vez que la pantalla de carga se retira.
const CELULAR = '(pointer: coarse) and (max-width: 700px), (pointer: coarse) and (max-height: 500px)';

export default function AvisoCelular() {
  const [abierto, setAbierto] = useState(false);
  useEffect(() => {
    if (!window.matchMedia?.(CELULAR).matches) return;
    const revisar = setInterval(() => {
      if (document.getElementById('boot-loader')) return;
      clearInterval(revisar);
      setAbierto(true);
    }, 400);
    return () => clearInterval(revisar);
  }, []);
  if (!abierto) return null;
  const cerrar = () => setAbierto(false);
  return <div className="aviso-celular" role="dialog" aria-modal="true" aria-labelledby="aviso-celular-titulo">
    <div className="aviso-celular-caja">
      <strong id="aviso-celular-titulo">Sugerencia</strong>
      <p>Hoshi está pensado para pantallas grandes. Desde el celular puedes explorar lo esencial; para volar con teclado y ratón y ver cada detalle, ábrelo en un computador.</p>
      <button onClick={cerrar} autoFocus>Entendido</button>
    </div>
  </div>;
}
