import { useEffect, useState } from 'react';

// El mapa de descubrimientos (≈ 0,7 MB, 0,2 MB comprimido) solo se descarga al abrir el modo.
export function useDescubrimientos(activo) {
  const [estado, setEstado] = useState({ data: null, status: 'idle' });
  const pedido = activo || estado.status !== 'idle';
  useEffect(() => {
    if (!pedido) return;
    let vigente = true;
    fetch('/data/exoplanet-discoveries.json')
      .then(response => { if (!response.ok) throw new Error(response.statusText); return response.json(); })
      .then(data => { if (vigente) setEstado({ data, status: 'ready' }); })
      .catch(() => { if (vigente) setEstado({ data: null, status: 'error' }); });
    return () => { vigente = false; };
  }, [pedido]);
  return activo && estado.status === 'idle' ? { data: null, status: 'loading' } : estado;
}
