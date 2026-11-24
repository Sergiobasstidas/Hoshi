import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { generarOortBola } from './oort.js';
import { LIGHT_YEAR_PC, oortOpacity, oortPointScale, smoothRange, solarDistance } from './scale';

const suave = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// Nube de Oort: 72.000 puntos de 2.000 a 100.000 UA con densidad n ∝ r^-3,5 y la forma de la marea galáctica (oort.js).
function nubeOort() {
  const nube = generarOortBola();
  // Las posiciones y el peso siguen n ∝ r^-3,5, pero el brillo está ajustado a propósito: el núcleo junta muchos puntos en
  // poca pantalla y se saturaba a blanco, y la nube exterior (hasta 100.000 UA) no se veía. El peso se recorta a 1 y los
  // puntos exteriores se realzan (exterior), así que en pantalla el brillo cae más o menos como r^-2 y el halo exterior se ve
  // más brillante de lo que sería. El peso del núcleo baja con la distancia de la cámara (uniform lejos).
  const alfa = Float32Array.from(nube.peso, p => 0.02 * Math.min(1, p));
  const exterior = Float32Array.from(nube.radioUA, r => suave(r, 6000, 45000));
  return { posiciones: nube.posiciones, alfa, exterior };
}
// Ganancia para que, con alfas de 0,003–0,02 por punto, la nube tenga el brillo de la envoltura anterior desde 1–3 años luz.
// Brillo lineal: cada punto suma su alfa; opacity es la rampa de oortOpacity (0,30 como máximo).
const BRILLO = 25;

export default function OortCloud({ origin }) {
  const materialRef = useRef();
  const pointsRef = useRef();
  const nube = useMemo(() => nubeOort(), []);
  const uniforms = useMemo(() => ({ opacity: { value: 0 }, pixelRatio: { value: 1 }, pointScale: { value: 1 }, lejos: { value: 0 } }), []);
  useFrame(({ camera, gl }) => {
    const opacity = oortOpacity(solarDistance(camera.position, origin));
    materialRef.current.uniforms.lejos.value = smoothRange(solarDistance(camera.position, origin) / LIGHT_YEAR_PC, 1, 3);
    pointsRef.current.visible = opacity > 0;
    materialRef.current.uniforms.opacity.value = opacity;
    materialRef.current.uniforms.pixelRatio.value = gl.getPixelRatio();
    materialRef.current.uniforms.pointScale.value = oortPointScale(solarDistance(camera.position, origin));
  });
  return <points ref={pointsRef} frustumCulled={false}>
    <bufferGeometry>
      <bufferAttribute attach="attributes-position" args={[nube.posiciones, 3]} />
      <bufferAttribute attach="attributes-alfa" args={[nube.alfa, 1]} />
      <bufferAttribute attach="attributes-exterior" args={[nube.exterior, 1]} />
    </bufferGeometry>
    <shaderMaterial ref={materialRef} uniforms={uniforms} transparent depthWrite={false} depthTest={false}
      blending={THREE.AdditiveBlending} toneMapped={false}
      vertexShader={`
        attribute float alfa;
        attribute float exterior;
        uniform float lejos;
        uniform float pixelRatio;
        uniform float pointScale;
        varying float vAlfa;
        #include <common>
        #include <logdepthbuf_pars_vertex>
        void main() {
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = 2.0 * pixelRatio * pointScale;
          vAlfa = alfa * (mix(0.3, 0.12, lejos) + mix(2.7, 2.88, lejos) * exterior);
          #include <logdepthbuf_vertex>
        }`}
      fragmentShader={`
        uniform float opacity;
        varying float vAlfa;
        #include <logdepthbuf_pars_fragment>
        void main() {
          vec2 p = gl_PointCoord * 2.0 - 1.0;
          float r = length(p);
          float a = 1.0 - smoothstep(0.45, 0.75, r);
          gl_FragColor = vec4(0.48, 0.56, 0.66, a * vAlfa * opacity * BRILLO);
          #include <logdepthbuf_fragment>
        }`.replace('BRILLO', BRILLO.toFixed(2))} />
  </points>;
}
