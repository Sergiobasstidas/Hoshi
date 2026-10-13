import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending } from 'three';
import { smoothRange } from './scale';
import { companionOrbitPc } from './visualBinary';

// Binarias visuales con órbita publicada (ORB6). Al acercarse, la compañera deja de
// coincidir con el punto del catálogo. Marcadores de ubicación: su tamaño en píxeles
// no representa un radio estelar. Véase docs/BINARIAS.md.
const MAX_ACTIVE = 6;
// Distancias de aparición en múltiplos del apoastro de cada sistema.
const MARKER_RANGE = [250, 600], ORBIT_RANGE = [60, 300];

function CompanionSystem({ system, origin }) {
  const line = useRef(), material = useRef();
  const position = useMemo(() => system.position.map((v, i) => v - origin[i]), [system, origin]);
  const orbit = useMemo(() => new Float32Array(companionOrbitPc(system.orbit, system.position).flat()), [system]);
  const marker = useMemo(() => new Float32Array(system.offsetPc), [system]);
  const color = useMemo(() => new Float32Array((system.companion?.rgb || [223, 230, 255]).map(v => v / 255)), [system]);
  const uniforms = useMemo(() => ({ pixelRatio: { value: 1 }, opacity: { value: 0 } }), []);
  useFrame(({ camera, gl }) => {
    const distance = Math.hypot(camera.position.x - position[0], camera.position.y - position[1], camera.position.z - position[2]) / system.apastronPc;
    line.current.material.opacity = 0.3 * (1 - smoothRange(distance, ...ORBIT_RANGE));
    line.current.visible = line.current.material.opacity > 0.003;
    material.current.uniforms.opacity.value = 1 - smoothRange(distance, ...MARKER_RANGE);
    material.current.uniforms.pixelRatio.value = gl.getPixelRatio();
  });
  return <group position={position}>
    <line ref={line} frustumCulled={false}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[orbit, 3]} /></bufferGeometry>
      <lineBasicMaterial color="#8fa3c4" transparent opacity={0} depthWrite={false} />
    </line>
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[marker, 3]} />
        <bufferAttribute attach="attributes-color" args={[color, 3]} />
      </bufferGeometry>
      <shaderMaterial ref={material} transparent depthWrite={false} toneMapped={false} blending={AdditiveBlending} uniforms={uniforms}
        vertexShader={`
          uniform float pixelRatio;
          attribute vec3 color;
          varying vec3 tint;
          #include <common>
          #include <logdepthbuf_pars_vertex>
          void main() {
            tint = color;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = 10.0 * pixelRatio;
            #include <logdepthbuf_vertex>
          }`}
        fragmentShader={`
          uniform float opacity;
          varying vec3 tint;
          #include <logdepthbuf_pars_fragment>
          void main() {
            vec2 p = gl_PointCoord * 2.0 - 1.0;
            float r2 = dot(p, p);
            float alpha = exp(-r2 * 9.0) + 0.18 * exp(-r2 * 3.0);
            gl_FragColor = vec4(tint, opacity * alpha * (1.0 - smoothstep(0.65, 1.0, r2)));
            #include <logdepthbuf_fragment>
          }`} />
    </points>
  </group>;
}

export default function CompanionStars({ systems, origin }) {
  const [active, setActive] = useState([]);
  const key = useRef('');
  useFrame(({ camera }) => {
    const x = camera.position.x + origin[0], y = camera.position.y + origin[1], z = camera.position.z + origin[2];
    const near = [];
    for (const system of systems) {
      const distance = Math.hypot(x - system.position[0], y - system.position[1], z - system.position[2]);
      if (distance < system.apastronPc * MARKER_RANGE[1]) near.push({ system, distance });
    }
    near.sort((a, b) => a.distance - b.distance);
    const next = near.slice(0, MAX_ACTIVE).map(entry => entry.system);
    const nextKey = next.map(system => system.id).join(',');
    if (nextKey !== key.current) { key.current = nextKey; setActive(next); }
  });
  return active.map(system => <CompanionSystem key={system.id} system={system} origin={origin} />);
}
