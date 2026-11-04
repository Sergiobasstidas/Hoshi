import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { smoothRange } from './scale';
import { MIEMBROS_PARA_NOMBRE } from './datosCumulos';

// Cúmulos: de lejos solo su nombre en letra fina, sin tocar el brillo de ninguna estrella. Al elegirlo,
// App lo encuadra, abre su ficha y resalta a sus miembros.
export default function Cumulos({ datos, origin, elegido, onElegir }) {
  // El resaltado vive aquí y no en App: pasar el cursor no vuelve a dibujar toda la aplicación.
  const [resaltado, onResaltar] = useState(null);
  const nombres = useRef(new Map());
  const visibles = useMemo(() => datos.cumulos.filter(c => c.ids.length >= MIEMBROS_PARA_NOMBRE), [datos]);
  useFrame(({ camera }) => {
    const desdeSol = Math.hypot(camera.position.x + origin[0], camera.position.y + origin[1], camera.position.z + origin[2]);
    // Dentro del sistema solar los nombres se apagan: ahí mandan los planetas.
    const lejosDelSol = smoothRange(desdeSol, 0.2, 2);
    for (const cumulo of visibles) {
      const elemento = nombres.current.get(cumulo.id);
      if (!elemento) continue;
      const visible = cumulo.id === elegido?.id || cumulo.id === resaltado?.id ? 1 : lejosDelSol;
      elemento.style.opacity = visible.toFixed(3);
      elemento.style.pointerEvents = visible > 0.3 ? 'auto' : 'none';
    }
  });
  const marcado = resaltado || elegido;
  return <>
    {visibles.map(cumulo => <Html key={cumulo.id} position={[cumulo.x - origin[0], cumulo.y - origin[1], cumulo.z - origin[2]]} center zIndexRange={[17, 9]}>
        <button ref={elemento => { if (elemento) nombres.current.set(cumulo.id, elemento); else nombres.current.delete(cumulo.id); }}
          className={`cumulo-nombre${cumulo.id === marcado?.id ? ' activo' : ''}`} style={{ opacity: 0 }}
          onPointerEnter={() => onResaltar(cumulo)} onPointerLeave={() => onResaltar(null)} onFocus={() => onResaltar(cumulo)} onBlur={() => onResaltar(null)}
          onClick={() => onElegir(cumulo)} title={`${cumulo.nombre}: clic para encuadrarlo`}>{cumulo.nombre}</button>
      </Html>)}
  </>;
}
