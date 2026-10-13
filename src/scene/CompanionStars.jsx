import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { AdditiveBlending } from 'three';
import { smoothRange } from './scale';
import { companionOrbitPc } from './visualBinary';

// Componentes de sistemas múltiples (ORB6 y WDS). Al acercarse, cada compañera deja de
// coincidir con el punto del catálogo. Los puntos son marcadores: su tamaño indica
// brillo relativo, no un radio estelar. Véase docs/BINARIAS.md.
const MAX_ACTIVE = 6;
// Distancias de aparición en múltiplos de la separación de cada componente.
const MARKER_RANGE = [250, 600], LINE_RANGE = [60, 300], LABEL_RANGE = [45, 110];

function CompanionSystem({ system, origin }) {
  const lines = useRef(), material = useRef(), points = useRef(), labels = useRef([]);
  const position = useMemo(() => system.position.map((v, i) => v - origin[i]), [system, origin]);
  // Las compañeras que ya son un registro del catálogo se dibujan con el campo estelar.
  const drawn = useMemo(() => system.components.filter(component => !component.companion), [system]);
  const paths = useMemo(() => system.components.map(component => new Float32Array(component.pair.k === 'o'
    ? companionOrbitPc(component.pair, system.position).flatMap(p => p.map((v, i) => v + component.parentOffsetPc[i]))
    : [...component.parentOffsetPc, ...component.offsetPc])), [system]);
  const attributes = useMemo(() => ({
    position: new Float32Array(drawn.flatMap(component => component.offsetPc)),
    color: new Float32Array(drawn.flatMap(component => component.color.map(v => v / 255))),
    size: new Float32Array(drawn.map(component => component.sizePx)),
    alpha: new Float32Array(drawn.length),
  }), [drawn]);
  const uniforms = useMemo(() => ({ pixelRatio: { value: 1 } }), []);
  useFrame(({ camera, gl }) => {
    const range = component => Math.hypot(camera.position.x - position[0] - component.offsetPc[0],
      camera.position.y - position[1] - component.offsetPc[1], camera.position.z - position[2] - component.offsetPc[2]) / component.scalePc;
    system.components.forEach((component, i) => {
      const line = lines.current.children[i];
      line.material.opacity = (component.pair.k === 'o' ? 0.3 : 0.14) * (1 - smoothRange(range(component), ...LINE_RANGE));
      line.visible = line.material.opacity > 0.003;
    });
    drawn.forEach((component, i) => {
      const distance = range(component);
      attributes.alpha[i] = 1 - smoothRange(distance, ...MARKER_RANGE);
      const label = labels.current[i];
      if (label) label.style.opacity = 1 - smoothRange(distance, ...LABEL_RANGE);
    });
    if (points.current) points.current.geometry.attributes.alpha.needsUpdate = true;
    if (material.current) material.current.uniforms.pixelRatio.value = gl.getPixelRatio();
  });
  return <group position={position}>
    <group ref={lines}>
      {paths.map((path, i) => <line key={i} frustumCulled={false}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[path, 3]} /></bufferGeometry>
        <lineBasicMaterial color="#8fa3c4" transparent opacity={0} depthWrite={false} />
      </line>)}
    </group>
    {drawn.length > 0 && <points ref={points} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[attributes.position, 3]} />
        <bufferAttribute attach="attributes-color" args={[attributes.color, 3]} />
        <bufferAttribute attach="attributes-size" args={[attributes.size, 1]} />
        <bufferAttribute attach="attributes-alpha" args={[attributes.alpha, 1]} />
      </bufferGeometry>
      <shaderMaterial ref={material} transparent depthWrite={false} toneMapped={false} blending={AdditiveBlending} uniforms={uniforms}
        vertexShader={`
          uniform float pixelRatio;
          attribute vec3 color;
          attribute float size;
          attribute float alpha;
          varying vec3 tint;
          varying float fade;
          #include <common>
          #include <logdepthbuf_pars_vertex>
          void main() {
            tint = color;
            fade = alpha;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = size * pixelRatio;
            #include <logdepthbuf_vertex>
          }`}
        fragmentShader={`
          varying vec3 tint;
          varying float fade;
          #include <logdepthbuf_pars_fragment>
          void main() {
            vec2 p = gl_PointCoord * 2.0 - 1.0;
            float r2 = dot(p, p);
            float alpha = exp(-r2 * 9.0) + 0.18 * exp(-r2 * 3.0);
            gl_FragColor = vec4(tint, fade * alpha * (1.0 - smoothstep(0.65, 1.0, r2)));
            #include <logdepthbuf_fragment>
          }`} />
    </points>}
    {drawn.map((component, i) => <Html key={component.name} position={component.offsetPc} zIndexRange={[18, 10]} style={{ pointerEvents: 'none' }}>
      <span ref={element => { labels.current[i] = element; }} className="companion-label" style={{ opacity: 0 }}>{component.label}</span>
    </Html>)}
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
      if (distance < system.rangePc * MARKER_RANGE[1]) near.push({ system, distance });
    }
    near.sort((a, b) => a.distance - b.distance);
    const next = near.slice(0, MAX_ACTIVE).map(entry => entry.system);
    const nextKey = next.map(system => system.id).join(',');
    if (nextKey !== key.current) { key.current = nextKey; setActive(next); }
  });
  return active.map(system => <CompanionSystem key={system.id} system={system} origin={origin} />);
}
