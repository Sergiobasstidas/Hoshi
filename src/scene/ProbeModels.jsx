import { lazy, Suspense, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { BODY_CAMERA_NEAR_PC, KM_TO_PC } from './scale';
import { useProbes } from './probeTrajectories';

// Modelo 3D de la sonda más cercana a la cámara. De lejos la sonda es su hexágono y su cola
// (VisualGuides.jsx, ProbeComets.jsx); a menos de LOAD_KM se pide el modelo (código y archivo
// aparte) y se dibuja a escala real, todavía de menos de un píxel: no hay salto al reemplazar.
// La nave mide unos metros y el plano cercano de la escena está a unos 300 m: junto a una sonda
// la cámara usa un plano cercano de 3 cm.
const ProbeModel = lazy(() => import('./ProbeModel'));
const LOAD_KM = 50000, CLOSE_NEAR_KM = 50;
const CLOSE_NEAR_PC = 1e-17;

// `extra`: sondas «entonces» (SondaEntonces.jsx), con `key` propio, que también reciben su modelo.
export default function ProbeModels({ origin, extra = [] }) {
  const { probes: today } = useProbes();
  const probes = [...today.map(probe => ({ ...probe, key: probe.code })), ...extra];
  const [active, setActive] = useState(null);
  const near = useRef(false);
  useFrame(({ camera }) => {
    let best = null, bestKm = Infinity;
    for (const probe of probes) {
      const km = Math.hypot(camera.position.x + origin[0] - probe.position[0], camera.position.y + origin[1] - probe.position[1],
        camera.position.z + origin[2] - probe.position[2]) / KM_TO_PC;
      if (km < bestKm) { best = probe; bestKm = km; }
    }
    const code = bestKm < LOAD_KM ? best.key : null;
    if (code !== active) setActive(code);
    const close = bestKm < CLOSE_NEAR_KM;
    if (close !== near.current) {
      near.current = close;
      camera.near = close ? CLOSE_NEAR_PC : BODY_CAMERA_NEAR_PC;
      camera.updateProjectionMatrix();
    }
  });
  const probe = probes.find(item => item.key === active);
  return probe ? <Suspense fallback={null}><ProbeModel key={probe.key} probe={probe} /></Suspense> : null;
}
