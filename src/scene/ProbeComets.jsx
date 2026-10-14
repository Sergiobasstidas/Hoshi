import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry } from 'three';
import { LIGHT_YEAR_PC, smoothRange, solarDistance } from './scale';
import { PROBE_COLOR, probeHighlight, useProbes } from './probeTrajectories';

// Voyager 1 y 2 y Pioneer 10 y 11 como en NASA Eyes: una cola corta, como de cometa, que sale
// de la sonda hacia atrás por su trayectoria real y se difumina antes de llegar al sistema
// solar (probeTailAu). Es una franja orientada a la cámara: ancha y visible en la sonda,
// estrecha y transparente en el otro extremo. Gris tenue; al pasar el ratón por el nombre se
// ensancha y aclara. El hexágono y el nombre son la etiqueta HTML (VisualGuides.jsx, App.css).
// Ancho y brillo son estilo, no dato.
const HOVER_COLOR = '#e6e9ee';
// Ancho total en píxeles en la sonda, sin y con el ratón encima; en la cola, TAIL_WIDTH.
const HEAD_WIDTH = [2.2, 5], TAIL_WIDTH = 0.6;
// La cola aparece cuando la distancia de la sonda al Sol ocupa estos píxeles.
const FADE_PIXELS = [40, 120];
const hexToRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);

export default function ProbeComets({ origin }) {
  const mesh = useRef();
  const { probes } = useProbes();
  const state = useRef([]);
  const geometry = useMemo(() => {
    // Cuatro vértices por sonda: cola (izquierda, derecha) y cabeza (izquierda, derecha).
    const position = [], other = [], progress = [], side = [], index = [];
    probes.forEach((probe, p) => {
      for (const [from, to, along] of [[probe.tail, probe.position, 0], [probe.position, probe.tail, 1]]) {
        for (const s of [-1, 1]) { position.push(...from); other.push(...to); progress.push(along); side.push(s); }
      }
      const v = p * 4;
      index.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
    });
    const result = new BufferGeometry();
    result.setAttribute('position', new BufferAttribute(new Float32Array(position), 3));
    result.setAttribute('other', new BufferAttribute(new Float32Array(other), 3));
    result.setAttribute('progress', new BufferAttribute(new Float32Array(progress), 1));
    result.setAttribute('side', new BufferAttribute(new Float32Array(side), 1));
    // Por vértice: resalte (0–1) y visibilidad (0–1) de su sonda, actualizados en cada cuadro.
    result.setAttribute('look', new BufferAttribute(new Float32Array(probes.length * 8), 2));
    result.setIndex(index);
    return result;
  }, [probes]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const uniforms = useMemo(() => ({ resolution: { value: [1, 1] }, baseColor: { value: hexToRgb(PROBE_COLOR) },
    hoverColor: { value: hexToRgb(HOVER_COLOR) }, widths: { value: [...HEAD_WIDTH, TAIL_WIDTH] }, opacity: { value: 1 } }), []);

  useFrame(({ camera, size }, delta) => {
    if (!mesh.current) return;
    const cameraPc = solarDistance(camera.position, origin);
    const far = 1 - smoothRange(cameraPc, 0.019 * LIGHT_YEAR_PC, 0.02 * LIGHT_YEAR_PC);
    mesh.current.visible = far > 0.01 && probes.length > 0;
    const focal = size.height / (2 * Math.tan(camera.fov * Math.PI / 360));
    const look = mesh.current.geometry.attributes.look;
    probes.forEach((probe, p) => {
      const target = probeHighlight.code === probe.code ? 1 : 0;
      const current = state.current[p] ?? 0;
      state.current[p] = current + (target - current) * (1 - Math.exp(-12 * delta));
      const fade = far * smoothRange(Math.hypot(...probe.position) / cameraPc * focal, ...FADE_PIXELS);
      for (let k = 0; k < 4; k++) look.setXY(p * 4 + k, state.current[p], fade);
    });
    look.needsUpdate = true;
    mesh.current.material.uniforms.resolution.value = [size.width, size.height];
  });

  if (probes.length === 0) return null;
  return <mesh ref={mesh} geometry={geometry} frustumCulled={false}>
    <shaderMaterial transparent depthWrite={false} toneMapped={false} uniforms={uniforms}
      vertexShader={`
        uniform vec2 resolution;
        uniform vec3 widths;
        attribute vec3 other;
        attribute float progress;
        attribute float side;
        attribute vec2 look;
        varying float vProgress;
        varying float vSide;
        varying vec2 vLook;
        #include <common>
        #include <logdepthbuf_pars_vertex>
        void main() {
          vProgress = progress; vSide = side; vLook = look;
          vec4 a = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          vec4 b = projectionMatrix * modelViewMatrix * vec4(other, 1.0);
          // Dirección de la franja en pantalla y desplazamiento perpendicular en píxeles.
          vec2 dir = b.w > 0.0 && a.w > 0.0 ? (b.xy / b.w - a.xy / a.w) * resolution : vec2(1.0, 0.0);
          dir = length(dir) > 1e-6 ? normalize(dir) : vec2(1.0, 0.0);
          float width = mix(widths.z, mix(widths.x, widths.y, look.x), progress);
          a.xy += vec2(-dir.y, dir.x) * side * width / resolution * a.w;
          gl_Position = a;
          #include <logdepthbuf_vertex>
        }`}
      fragmentShader={`
        uniform vec3 baseColor;
        uniform vec3 hoverColor;
        uniform float opacity;
        varying float vProgress;
        varying float vSide;
        varying vec2 vLook;
        #include <logdepthbuf_pars_fragment>
        void main() {
          // Opaca en la sonda y transparente hacia el Sol; bordes suaves a lo ancho.
          float alpha = pow(vProgress, 1.6) * (1.0 - smoothstep(0.35, 1.0, abs(vSide))) * vLook.y;
          gl_FragColor = vec4(mix(baseColor, hoverColor, vLook.x), alpha * opacity * mix(0.85, 1.0, vLook.x));
          #include <logdepthbuf_fragment>
        }`} />
  </mesh>;
}
