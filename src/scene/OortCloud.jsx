import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { OORT_F7, SIN_F7 } from '../f7/opciones.js';
import { generarOortBola, generarOortEspiral } from './oort.js';
import { LIGHT_YEAR_PC, OORT_INNER_PC, OORT_OUTER_PC, oortOpacity, oortPointScale, smoothRange, solarDistance } from './scale';

function buildOortPositions() {
    // Distribución ilustrativa con semilla, estable entre recargas y StrictMode.
    let seed = 1873;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const array = new Float32Array(140000 * 3);
    for (let i = 0; i < array.length / 3; i++) {
      const z = 2 * random() - 1;
      const angle = random() * Math.PI * 2;
      // Envoltura visual, no un modelo de densidad física medida. Algunas partículas
      // interiores se ven al atravesarla, pero se desvanecen fuera de la nube.
      const shell = random() > 0.1;
      const radius = shell
        ? OORT_OUTER_PC * (0.82 + 0.16 * (random() + random() + random()) / 3)
        : OORT_INNER_PC + (OORT_OUTER_PC - OORT_INNER_PC) * Math.cbrt(random());
      const xy = Math.sqrt(1 - z * z);
      array.set([radius * xy * Math.cos(angle), radius * xy * Math.sin(angle), radius * z], i * 3);
    }
    return array;
}

const suave = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// F-07 (?oort=o1|o2): 72.000 puntos con su propio peso de brillo (oort.js) en vez de la envoltura de hoy.
function nubeF7(variante) {
  const nube = variante === 'o1' ? generarOortEspiral() : generarOortBola();
  // O1: alfa por punto entre 0,01 y 0,03 (más alta en la espiral interior); O2: el peso de brillo de su densidad.
  let s = 7;
  const azar = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  // El núcleo junta muchos puntos en poca pantalla y se saturaba a blanco, y la nube exterior (hasta 100.000 UA) no se veía:
  // los puntos interiores pesan menos y los exteriores más, para que el exterior se vea como un halo tenue hasta su borde.
  // El peso del núcleo baja con la distancia de la cámara (OortF7): de cerca, la espiral sigue legible.
  const alfa = Float32Array.from({ length: nube.radioUA.length }, (_, k) => (nube.peso ? 0.02 * Math.min(1, nube.peso[k])
    : (nube.componente[k] === 0 ? 0.02 : 0.01) + 0.01 * azar()));
  const exterior = Float32Array.from(nube.radioUA, r => suave(r, 6000, 45000));
  return { posiciones: nube.posiciones, alfa, exterior };
}

export default function OortCloud({ origin }) {
  if (OORT_F7 !== 'hoy') return <OortF7 origin={origin} variante={OORT_F7} />;
  return <OortHoy origin={origin} />;
}

function OortF7({ origin, variante }) {
  const materialRef = useRef();
  const pointsRef = useRef();
  const nube = useMemo(() => nubeF7(variante), [variante]);
  const uniforms = useMemo(() => ({ opacity: { value: 0 }, pixelRatio: { value: 1 }, pointScale: { value: 1 }, lejos: { value: 0 } }), []);
  useFrame(({ camera, gl }) => {
    const opacity = oortOpacity(solarDistance(camera.position, origin));
    materialRef.current.uniforms.lejos.value = smoothRange(solarDistance(camera.position, origin) / LIGHT_YEAR_PC, 1, 3);
    pointsRef.current.visible = opacity > 0 && !SIN_F7.has('oort');
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
        }`.replace('BRILLO', BRILLO_F7.toFixed(2))} />
  </points>;
}
// Ganancia de las nubes de F-07 para que, con alfas de 0,01–0,03 por punto, se vean como la de hoy desde 1–3 años luz.
// Brillo lineal (β = 1): cada punto suma su alfa; opacity es la rampa de hoy (0,30 como máximo).
const BRILLO_F7 = 25;

function OortHoy({ origin }) {
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
