import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending } from 'three';
import { BINARY_STATE, binaryOrbitPoints } from './binaryOrbit';
import { AU_TO_PC, smoothRange } from './scale';

// Location markers only: their pixel diameter is not a stellar radius.
export default function BinarySystem({ position = [0, 0, 0] }) {
  const group = useRef();
  const material = useRef();
  const uniforms = useMemo(() => ({ pixelRatio: { value: 1 } }), []);
  const orbits = useMemo(() => ['wr', 'o'].map(key => new Float32Array(binaryOrbitPoints(key).flat())), []);
  const positions = useMemo(() => new Float32Array([...BINARY_STATE.wr, ...BINARY_STATE.o]), []);
  const colors = useMemo(() => new Float32Array([0.72, 0.83, 1, 0.93, 0.91, 0.78]), []);
  useFrame(({ camera, gl }) => {
    const distance = Math.hypot(camera.position.x-position[0], camera.position.y-position[1], camera.position.z-position[2]);
    const opacity = 1 - smoothRange(distance / AU_TO_PC, 150, 800);
    group.current.visible = opacity > 0.01;
    group.current.children.forEach(line => { line.material.opacity = opacity * 0.3; });
    material.current.uniforms.pixelRatio.value = gl.getPixelRatio();
  });
  return <group position={position}>
    <group ref={group}>
      {orbits.map((points, i) => <line key={i}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[points, 3]} /></bufferGeometry>
        <lineBasicMaterial color={i === 0 ? '#839abf' : '#baaf8d'} transparent opacity={0.3} depthWrite={false} />
      </line>)}
    </group>
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
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
            gl_PointSize = 12.0 * pixelRatio;
            #include <logdepthbuf_vertex>
          }`}
        fragmentShader={`
          varying vec3 tint;
          #include <logdepthbuf_pars_fragment>
          void main() {
            vec2 p = gl_PointCoord * 2.0 - 1.0;
            float r2 = dot(p, p);
            float alpha = exp(-r2 * 9.0) + 0.18 * exp(-r2 * 3.0);
            gl_FragColor = vec4(tint, alpha * (1.0 - smoothstep(0.65, 1.0, r2)));
            #include <logdepthbuf_fragment>
          }`} />
    </points>
  </group>;
}
