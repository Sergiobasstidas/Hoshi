import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { LIGHT_YEAR_PC, smoothRange, solarDistance } from './scale';
import FadingTrails from './FadingTrails';
import { useProbes } from './probeTrajectories';

// Rutas completas de Voyager 1 y 2 y Pioneer 10 y 11: estela de su trayectoria real desde el
// lanzamiento, que se apaga hacia el pasado y llega opaca a la posición de la fecha.
// Sergio la quiere guardada para activarla más adelante con un botón (prop `probeRoutes` de
// SolarSystem.jsx, hoy siempre falsa); la vista normal usa las colas de ProbeComets.jsx.
// Cada estela aparece según los píxeles que ocupa la distancia de su sonda al Sol, y todas se
// retiran entre 0,019 y 0,02 años luz, como la etiqueta.
const OPACITY = 1;
// El shader de la estela no convierte de lineal a sRGB: el color va ya en sRGB.
const ROUTE_COLOR = '#c3c8cf';
const hexToRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);

export default function ProbeTrails({ origin }) {
  const group = useRef();
  const { probes } = useProbes();
  const trails = useMemo(() => probes.map(probe => ({ points: probe.trail,
    color: hexToRgb(ROUTE_COLOR), size: probe.position && Math.hypot(...probe.position) })), [probes]);
  useFrame(({ camera }) => {
    const alpha = 1 - smoothRange(solarDistance(camera.position, origin), 0.019 * LIGHT_YEAR_PC, 0.02 * LIGHT_YEAR_PC);
    group.current.visible = alpha > 0.01;
    const material = group.current.children[0]?.material;
    if (material) material.uniforms.opacity.value = OPACITY * alpha;
  });
  return <group ref={group}>{trails.length > 0 && <FadingTrails trails={trails} fadePixels={[12, 50]} opacity={OPACITY} />}</group>;
}
