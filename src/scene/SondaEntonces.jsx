import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { AU_TO_PC, KM_TO_PC, smoothRange } from './scale';
import { probeCursor, probePositionAu, useProbes } from './probeTrajectories';
import { useFlybyPlayback } from './flybyPlayback';

// La sonda «entonces»: en la etapa elegida de la línea de tiempo (LineaTiempoSonda.jsx), un hexágono
// como el de la sonda de hoy, en el color de la etapa, con «Pioneer 10 · 2003», en su posición de esa
// fecha; de cerca lo reemplaza su modelo (ProbeModels.jsx). Al pasar el ratón por el gráfico de la
// línea, un punto tenue marca la sonda en esa fecha.
export default function SondaEntonces({ origin, then }) {
  const label = useRef();
  // Durante la animación de un paso, la sonda que se mueve reemplaza a la del máximo acercamiento.
  const animando = useFlybyPlayback().t !== null;
  useFrame(({ camera }) => {
    if (!label.current || !then) return;
    const km = Math.hypot(camera.position.x + origin[0] - then.position[0], camera.position.y + origin[1] - then.position[1],
      camera.position.z + origin[2] - then.position[2]) / KM_TO_PC;
    // A pocos km lo reemplaza el modelo, como a la sonda de hoy.
    label.current.style.setProperty('--hexagono', smoothRange(km, 1.5, 4));
  });
  return <>
    {then && !animando && <group position={then.position}>
      <Html zIndexRange={[19, 11]} style={{ pointerEvents: 'none' }}>
        <span ref={label} className="sonda-entonces" style={{ color: then.color }}>{then.name}</span>
      </Html>
    </group>}
    <CursorRuta />
  </>;
}

function CursorRuta() {
  const { probes } = useProbes();
  const group = useRef(), dot = useRef();
  const byCode = useMemo(() => new Map(probes.map(probe => [probe.code, probe])), [probes]);
  useFrame(() => {
    const probe = byCode.get(probeCursor.code);
    const visible = Boolean(probe && probeCursor.jd);
    if (dot.current) dot.current.style.opacity = visible ? 1 : 0;
    if (!visible || !group.current) return;
    group.current.position.fromArray(probePositionAu(probe.data, probeCursor.jd).map(value => value * AU_TO_PC));
  });
  return <group ref={group}>
    <Html zIndexRange={[19, 11]} style={{ pointerEvents: 'none' }}><span ref={dot} className="cursor-ruta" style={{ opacity: 0 }} /></Html>
  </group>;
}
