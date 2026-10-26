import { useEffect, useState } from 'react';

// Aviso único en el celular: aparece cuando la pantalla de carga se retira y no vuelve a salir
// después de pulsar «Entendido».
const CLAVE = 'hoshi-aviso-celular';
const CELULAR = '(pointer: coarse) and (max-width: 700px), (pointer: coarse) and (max-height: 500px)';
const visto = () => { try { return localStorage.getItem(CLAVE) === '1'; } catch { return false; } };

export default function AvisoCelular() {
  const [abierto, setAbierto] = useState(false);
  useEffect(() => {
    if (visto() || !window.matchMedia?.(CELULAR).matches) return;
    const revisar = setInterval(() => {
      if (document.getElementById('boot-loader')) return;
      clearInterval(revisar);
      setAbierto(true);
    }, 400);
    return () => clearInterval(revisar);
  }, []);
  if (!abierto) return null;
  const cerrar = () => {
    try { localStorage.setItem(CLAVE, '1'); } catch { /* sin almacenamiento: volverá a salir */ }
    setAbierto(false);
  };
  return <div className="aviso-celular" role="dialog" aria-modal="true" aria-labelledby="aviso-celular-titulo">
    <div className="aviso-celular-caja">
      <strong id="aviso-celular-titulo">Antes de despegar</strong>
      <p>Hoshi está pensado para pantallas grandes, con teclado y ratón. En el celular puedes recorrerlo, pero algunas funciones son limitadas.</p>
      <button onClick={cerrar} autoFocus>Entendido</button>
    </div>
  </div>;
}
