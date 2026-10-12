import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide } from 'three';
import { HELIOSPHERE_RADIUS_PC, HELIOSPHERE_BRIGHTNESS, heliosphereVisibility } from './heliosphereScale';
import simplex3d from './shaders/simplex3d.glsl?raw';
import { solarDistance } from './scale';

// Membrana translúcida estática, con textura procedural fija en el espacio.
// Sin tiempo, rotación, cola, flujo animado ni esfera opaca de fondo.
export default function Heliosphere({ origin }) {
  const surface = useRef();
  const material = useRef();
  const uniforms = useMemo(() => ({ visibility: { value: 0 } }), []);
  useFrame(({ camera }) => {
    const visibility = heliosphereVisibility(solarDistance(camera.position, origin));
    surface.current.visible = visibility > 0.001;
    material.current.uniforms.visibility.value = visibility * HELIOSPHERE_BRIGHTNESS;
  });
  return <group ref={surface} scale={HELIOSPHERE_RADIUS_PC} visible={false}>
    <mesh renderOrder={1}>
    <sphereGeometry args={[1, 144, 96]} />
    <shaderMaterial ref={material} uniforms={uniforms} transparent depthWrite={false}
      side={DoubleSide} forceSinglePass toneMapped={false}
      vertexShader={`
        varying vec3 spherePosition;
        varying vec3 viewNormal;
        varying vec3 viewDirection;
        #include <common>
        #include <logdepthbuf_pars_vertex>
        ${simplex3d}
        void main() {
          spherePosition = position;
          // Pequeñas ondulaciones estáticas rompen el contorno perfecto; 120 UA sigue
          // siendo la referencia nominal, no un límite medido.
          float ripple = 0.008 * snoise(position * 3.0) + 0.003 * snoise(position * 7.0);
          vec4 viewPosition = modelViewMatrix * vec4(position * (1.0 + ripple), 1.0);
          viewNormal = normalize(normalMatrix * normal);
          viewDirection = -viewPosition.xyz;
          gl_Position = projectionMatrix * viewPosition;
          #include <logdepthbuf_vertex>
        }`}
      fragmentShader={`
        uniform float visibility;
        varying vec3 spherePosition;
        varying vec3 viewNormal;
        varying vec3 viewDirection;
        #include <logdepthbuf_pars_fragment>
        ${simplex3d}
        float cloudTexture(vec3 p) {
          // Gradientes simplex sustituyen las celdas cúbicas visibles del ruido de valores.
          // Un desplazamiento suave y estático curva las nubes en filamentos irregulares.
          vec3 warp = vec3(snoise(p * 0.43), snoise(p * 0.43 + 13.7), snoise(p * 0.43 + 31.9));
          p += warp * 1.15;
          mat3 turn = mat3(2.0, 2.0, -1.0, -1.0, 2.0, 2.0, 2.0, -1.0, 2.0) / 3.0;
          float footprint = max(length(dFdx(p)), length(dFdy(p)));
          float cloud = 0.0;
          float weight = 0.5;
          for (int layer = 0; layer < 4; layer++) {
            // Promediar el detalle inferior al píxel para evitar destellos a distancia.
            float resolved = 1.0 - smoothstep(0.35, 1.0, footprint);
            // Manchas amplias de nube con detalle fino filtrado, sin redes de crestas.
            float ridge = 0.5 + 0.5 * snoise(p);
            cloud += weight * mix(0.5, ridge, resolved);
            p = turn * p * 2.13 + vec3(17.3, 11.8, 8.7);
            footprint *= 2.13;
            weight *= 0.5;
          }
          return cloud / 0.9375;
        }
        void main() {
          vec3 p = normalize(spherePosition);
          float cloud = cloudTexture(p * vec3(3.0, 3.8, 3.0));
          float lace = smoothstep(0.2, 0.85, cloud);
          float rim = pow(1.0 - abs(dot(normalize(viewNormal), normalize(viewDirection))), 2.0);
          float folds = 0.75 + 0.25 * snoise(p * 2.0 + vec3(4.0));
          vec3 tint = mix(vec3(0.28, 0.09, 0.035), vec3(0.72, 0.34, 0.12), lace);
          tint += vec3(0.22, 0.075, 0.01) * rim;
          float alpha = visibility * (0.018 + 0.065 * lace + rim * (0.18 + 0.12 * lace + 0.08 * folds));
          gl_FragColor = vec4(tint, alpha);
          #include <logdepthbuf_fragment>
        }`} />
  </mesh></group>;
}
