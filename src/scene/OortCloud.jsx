import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { OORT_INNER_PC, OORT_OUTER_PC, oortOpacity, oortPointScale, solarDistance } from './scale';

function buildOortPositions() {
    // Seeded illustrative distribution, stable across reloads and StrictMode.
    let seed = 1873;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const array = new Float32Array(140000 * 3);
    for (let i = 0; i < array.length / 3; i++) {
      const z = 2 * random() - 1;
      const angle = random() * Math.PI * 2;
      // Visual shell, not a measured physical density model. A few inner
      // particles remain visible during passage, but fade outside the cloud.
      const shell = random() > 0.1;
      const radius = shell
        ? OORT_OUTER_PC * (0.82 + 0.16 * (random() + random() + random()) / 3)
        : OORT_INNER_PC + (OORT_OUTER_PC - OORT_INNER_PC) * Math.cbrt(random());
      const xy = Math.sqrt(1 - z * z);
      array.set([radius * xy * Math.cos(angle), radius * xy * Math.sin(angle), radius * z], i * 3);
    }
    return array;
}

export default function OortCloud({ origin }) {
  const materialRef = useRef();
  const pointsRef = useRef();
  const positions = useMemo(() => buildOortPositions(), []);
  const uniforms = useMemo(() => ({ opacity: { value: 0 }, pixelRatio: { value: 1 },
    cameraDistance: { value: 0 }, outerRadius: { value: OORT_OUTER_PC }, pointScale: { value: 1 } }), []);
  useFrame(({ camera, gl }) => {
    const distance = solarDistance(camera.position, origin);
    const opacity = oortOpacity(distance);
    pointsRef.current.visible = opacity > 0;
    materialRef.current.uniforms.opacity.value = opacity;
    materialRef.current.uniforms.cameraDistance.value = distance;
    materialRef.current.uniforms.pixelRatio.value = gl.getPixelRatio();
    materialRef.current.uniforms.pointScale.value = oortPointScale(distance);
  });
  return <points ref={pointsRef}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
    <shaderMaterial ref={materialRef} uniforms={uniforms} transparent depthWrite={false} depthTest={false}
      blending={THREE.AdditiveBlending} toneMapped={false}
      vertexShader={`
        uniform float pixelRatio;
        uniform float cameraDistance;
        uniform float outerRadius;
        uniform float pointScale;
        varying float densityAlpha;
        #include <common>
  #include <logdepthbuf_pars_vertex>
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = 2.0 * pixelRatio * pointScale;
          float radius = length(position) / outerRadius;
          float shellDensity = smoothstep(0.79, 0.86, radius)
            * (1.0 - smoothstep(0.94, 0.995, radius));
          float outside = smoothstep(outerRadius, outerRadius * 1.6, cameraDistance);
          densityAlpha = mix(1.0, shellDensity, outside);
          #include <logdepthbuf_vertex>
        }`}
      fragmentShader={`
        uniform float opacity;
        varying float densityAlpha;
        #include <logdepthbuf_pars_fragment>
        void main() {
          vec2 p = gl_PointCoord * 2.0 - 1.0;
          float radius = length(p);
          float edge = max(fwidth(radius), 0.08);
          float alpha = (1.0 - smoothstep(0.65 - edge, 0.65 + edge, radius)) * 0.7;
          gl_FragColor = vec4(0.48, 0.56, 0.66, alpha * opacity * densityAlpha * 0.65);
          #include <logdepthbuf_fragment>
        }`} />
  </points>;
}
