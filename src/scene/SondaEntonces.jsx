import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { AU_TO_PC, KM_TO_PC, smoothRange } from './scale';
import { anchorHidden } from './labelOcclusion';
import { probeCursor, probePositionAu, useCursorActivo, useProbes } from './probeTrajectories';
import { useFlybyPlayback } from './flybyPlayback';

// La sonda «entonces»: en la etapa elegida de la línea de tiempo (LineaTiempoSonda.jsx), un hexágono
// como el de la sonda de hoy, en el color de la etapa, con «Pioneer 10 · 2003», en su posición de esa
// fecha; de cerca lo reemplaza su modelo (ProbeModels.jsx). Al pasar el ratón por el gráfico de la
// línea, un punto tenue marca la sonda en esa fecha.
export default function SondaEntonces({ origin, then }) {
  const label = useRef();
  // Durante la animación de un paso, la sonda que se mueve reemplaza a la del máximo acercamiento.
  const animando = useFlybyPlayback().t !== null;
  const recorriendo = useCursorActivo();
  useFrame(({ camera, size }) => {
    if (!label.current || !then) return;
    // Detrás de un planeta, una luna o el Sol más cercanos no se ve.
    const hidden = anchorHidden(then.position[0] - origin[0], then.position[1] - origin[1], then.position[2] - origin[2],
      camera, size, 14 + then.name.length * 6.2 + 8, 7);
    label.current.style.visibility = hidden ? 'hidden' : 'visible';
    const km = Math.hypot(camera.position.x + origin[0] - then.position[0], camera.position.y + origin[1] - then.position[1],
      camera.position.z + origin[2] - then.position[2]) / KM_TO_PC;
    // A pocos km lo reemplaza el modelo, como a la sonda de hoy.
    label.current.style.setProperty('--hexagono', smoothRange(km, 1.5, 4));
  });
  return <>
    {then && !animando && !recorriendo && <group position={then.position}>
      <Html zIndexRange={[19, 11]} style={{ pointerEvents: 'none' }}>
        <span ref={label} className="sonda-entonces" style={{ color: then.color }}>{then.name}</span>
      </Html>
    </group>}
    <CursorRuta origin={origin} />
  </>;
}

// Sonda en la fecha bajo el ratón en el gráfico de la línea de tiempo: el mismo hexágono que la sonda,
// con su nombre y el año; mientras está, la sonda «entonces» de la etapa se oculta.
function CursorRuta({ origin }) {
  const { probes } = useProbes();
  const group = useRef(), dot = useRef(), text = useRef();
  const byCode = useMemo(() => new Map(probes.map(probe => [probe.code, probe])), [probes]);
  useFrame(({ camera, size }) => {
    const probe = byCode.get(probeCursor.code);
    let visible = Boolean(probe && probeCursor.jd);
    if (visible && group.current) {
      const position = probePositionAu(probe.data, probeCursor.jd).map(value => value * AU_TO_PC);
      group.current.position.fromArray(position);
      group.current.updateMatrixWorld();
      if (text.current) text.current.textContent = `${probe.name} · ${new Date((probeCursor.jd - 2440587.5) * 86400000).getUTCFullYear()}`;
      // Detrás de un cuerpo más cercano no se ve.
      visible = !anchorHidden(position[0] - origin[0], position[1] - origin[1], position[2] - origin[2], camera, size,
        14 + (text.current?.textContent.length ?? 0) * 6.2 + 8, 7);
    }
    if (dot.current) {
      dot.current.style.opacity = visible ? 1 : 0;
      dot.current.style.visibility = visible ? 'visible' : 'hidden';
    }
  });
  return <group ref={group}>
    <Html zIndexRange={[20, 12]} style={{ pointerEvents: 'none' }}>
      <span ref={dot} className="sonda-entonces cursor-ruta" style={{ opacity: 0 }}><span ref={text} /></span>
    </Html>
  </group>;
}
