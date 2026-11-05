import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry } from 'three';
import { LIGHT_YEAR_PC, smoothRange, solarDistance } from './scale';
import { PROBE_COLOR, probeHidden, probeLit, useProbes } from './probeTrajectories';

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

// Una franja por sonda, con la geometría respecto de la sonda (la malla se coloca en ella con doble
// precisión): de cerca no tiembla y llega hasta el modelo. Si un extremo queda detrás de la cámara, el
// sombreador lo lleva hasta justo delante de ella a lo largo de la franja.
function ProbeComet({ probe, origin, uniforms }) {
  const mesh = useRef(), lit = useRef(0);
  const geometry = useMemo(() => {
    const tail = probe.tail.map((value, i) => value - probe.position[i]), head = [0, 0, 0];
    const position = [], other = [], progress = [], side = [];
    for (const [from, to, along] of [[tail, head, 0], [head, tail, 1]]) {
      for (const s of [-1, 1]) { position.push(...from); other.push(...to); progress.push(along); side.push(s); }
    }
    const result = new BufferGeometry();
    result.setAttribute('position', new BufferAttribute(new Float32Array(position), 3));
    result.setAttribute('other', new BufferAttribute(new Float32Array(other), 3));
    result.setAttribute('progress', new BufferAttribute(new Float32Array(progress), 1));
    result.setAttribute('side', new BufferAttribute(new Float32Array(side), 1));
    result.setIndex([0, 1, 2, 1, 3, 2]);
    return result;
  }, [probe]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const material = useMemo(() => ({ ...uniforms, look: { value: [0, 0] } }), [uniforms]);
  useFrame(({ camera, size }, delta) => {
    if (!mesh.current) return;
    const cameraPc = solarDistance(camera.position, origin);
    const far = 1 - smoothRange(cameraPc, 0.019 * LIGHT_YEAR_PC, 0.02 * LIGHT_YEAR_PC);
    const focal = size.height / (2 * Math.tan(camera.fov * Math.PI / 360));
    lit.current += ((probeLit(probe.code) ? 1 : 0) - lit.current) * (1 - Math.exp(-12 * delta));
    const fade = (probeHidden(probe.code) ? 0 : far) * smoothRange(Math.hypot(...probe.position) / cameraPc * focal, ...FADE_PIXELS);
    mesh.current.visible = fade > 0.005;
    mesh.current.material.uniforms.look.value = [lit.current, fade];
    mesh.current.material.uniforms.resolution.value = [size.width, size.height];
  });
  return <mesh ref={mesh} geometry={geometry} position={probe.position} frustumCulled={false}>
    <shaderMaterial transparent depthWrite={false} toneMapped={false} uniforms={material}
      vertexShader={`
        uniform vec2 resolution;
        uniform vec3 widths;
        uniform vec2 look;
        attribute vec3 other;
        attribute float progress;
        attribute float side;
        varying float vProgress;
        varying float vSide;
        #include <common>
        #include <logdepthbuf_pars_vertex>
        void main() {
          vSide = side;
          vec4 a = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          vec4 b = projectionMatrix * modelViewMatrix * vec4(other, 1.0);
          float along = progress;
          // Extremo detrás de la cámara: se lleva por la franja hasta justo delante del plano cercano.
          float nearW = max(-projectionMatrix[3][2] * 0.5, 1e-30) * 2.0;
          if (a.w < nearW && b.w > nearW) {
            float t = (nearW - a.w) / (b.w - a.w);
            a = mix(a, b, t);
            along = mix(progress, 1.0 - progress, t);
          }
          vProgress = along;
          // Dirección de la franja en pantalla y desplazamiento perpendicular en píxeles.
          vec2 dir = b.w > 0.0 && a.w > 0.0 ? (b.xy / b.w - a.xy / a.w) * resolution : vec2(1.0, 0.0);
          dir = length(dir) > 1e-6 ? normalize(dir) : vec2(1.0, 0.0);
          float width = mix(widths.z, mix(widths.x, widths.y, look.x), along);
          a.xy += vec2(-dir.y, dir.x) * side * width / resolution * a.w;
          gl_Position = a;
          #include <logdepthbuf_vertex>
        }`}
      fragmentShader={`
        uniform vec3 baseColor;
        uniform vec3 hoverColor;
        uniform float opacity;
        uniform vec2 look;
        varying float vProgress;
        varying float vSide;
        #include <logdepthbuf_pars_fragment>
        void main() {
          // Opaca en la sonda y transparente hacia el Sol; bordes suaves a lo ancho.
          float alpha = pow(vProgress, 1.6) * (1.0 - smoothstep(0.35, 1.0, abs(vSide))) * look.y;
          gl_FragColor = vec4(mix(baseColor, hoverColor, look.x), alpha * opacity * mix(0.85, 1.0, look.x));
          #include <logdepthbuf_fragment>
        }`} />
  </mesh>;
}

export default function ProbeComets({ origin }) {
  const { probes } = useProbes();
  const uniforms = useMemo(() => ({ resolution: { value: [1, 1] }, baseColor: { value: hexToRgb(PROBE_COLOR) },
    hoverColor: { value: hexToRgb(HOVER_COLOR) }, widths: { value: [...HEAD_WIDTH, TAIL_WIDTH] }, opacity: { value: 1 } }), []);
  return <>{probes.map(probe => <ProbeComet key={probe.code} probe={probe} origin={origin} uniforms={uniforms} />)}</>;
}
