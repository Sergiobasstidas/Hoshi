import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { AU_TO_PC, smoothRange } from './scale';
import { enZonaHabitable, zonaDeEstrella } from './zonaHabitable';

const CAPAS = 28;
const OPACIDAD = 0.011 * 48 / CAPAS;
const SEMIALTURA = 0.09, BORDE = 0.027;
const VERTICE = /* glsl */`
  uniform float exterior;
  varying vec2 plano;
  varying float altura;
  void main() {
    plano = position.xy / exterior;
    altura = position.z / exterior;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
// Bruma lisa: tono claro en el centro de la zona conservadora y oscuro en los márgenes optimistas.
const FRAGMENTO = /* glsl */`
  uniform float optimistaInterior, interior, exteriorConservador, ancho, opacidad;
  uniform vec3 colorBorde, colorCentro;
  varying vec2 plano;
  varying float altura;
  float suave(float a) { a = clamp(a, 0.0, 1.0); return a * a * (3.0 - 2.0 * a); }
  void main() {
    float borde = ${BORDE} * ancho, grosor = ${SEMIALTURA} * ancho;
    float radio = length(plano);
    float dentro = suave((radio - optimistaInterior) / borde) * suave((1.0 - radio) / borde);
    if (dentro <= 0.0) discard;
    float conservadora = suave((radio - interior) / (borde * 0.6)) * suave((exteriorConservador - radio) / (borde * 0.6));
    float arco = radio > interior && radio < exteriorConservador ? sin(3.14159265 * (radio - interior) / (exteriorConservador - interior)) : 0.0;
    float perfil = dentro * mix(0.38, 0.8 + 0.2 * arco, conservadora);
    float alto = grosor * (0.55 + 0.45 * perfil);
    float capa = 1.0 - smoothstep(alto * 0.55, alto, abs(altura));
    if (capa <= 0.0) discard;
    gl_FragColor = vec4(mix(colorBorde, colorCentro, conservadora * (0.45 + 0.55 * arco)), perfil * capa * opacidad);
  }
`;
// Planos apilados en una sola geometría: un cuadrado por capa, a lo alto de la franja.
function capasDeBruma(radio, semialtura) {
  const posiciones = [], indices = [];
  for (let capa = 0; capa < CAPAS; capa++) {
    const z = semialtura * (2 * capa / (CAPAS - 1) - 1), base = capa * 4;
    posiciones.push(-radio, -radio, z, radio, -radio, z, radio, radio, z, -radio, radio, z);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute('position', new THREE.Float32BufferAttribute(posiciones, 3));
  geometria.setIndex(indices);
  return geometria;
}

// Franja de la zona habitable alrededor de la estrella, en el plano de las órbitas.
export default function FranjaHabitable({ star, origin, fichas }) {
  const zona = useMemo(() => zonaDeEstrella(star, fichas), [star, fichas]);
  const sistema = star.planetary?.[0];
  const orientacion = useMemo(() => {
    // Sin órbitas conocidas, de frente a quien llega desde el Sol.
    const normal = new THREE.Vector3(...(sistema?.viewUp || [star.x, star.y, star.z])).normalize();
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  }, [sistema, star]);
  const geometria = useMemo(() => zona && capasDeBruma(zona.optimistaExterior * AU_TO_PC, SEMIALTURA * (zona.optimistaExterior - zona.optimistaInterior) * AU_TO_PC), [zona]);
  const uniforms = useMemo(() => zona && ({
    exterior: { value: zona.optimistaExterior * AU_TO_PC },
    optimistaInterior: { value: zona.optimistaInterior / zona.optimistaExterior },
    interior: { value: zona.interior / zona.optimistaExterior },
    exteriorConservador: { value: zona.exterior / zona.optimistaExterior },
    ancho: { value: 1 - zona.optimistaInterior / zona.optimistaExterior },
    opacidad: { value: 0 },
    colorBorde: { value: new THREE.Color('#1d6b5e') },
    colorCentro: { value: new THREE.Color('#9af2d4') },
  }), [zona]);
  const material = useRef();
  useEffect(() => () => geometria?.dispose(), [geometria]);
  // El círculo se retira en cuanto el disco del planeta se distingue en pantalla: nunca queda encima.
  const circulos = useRef([]);
  useFrame(({ camera, size }, delta) => {
    const focal = size.height / (2 * Math.tan(camera.fov * Math.PI / 360));
    sistema?.planets.forEach((planeta, i) => {
      const circulo = circulos.current[i];
      if (!circulo) return;
      const distancia = Math.hypot(camera.position.x - star.x + origin[0] - planeta.offsetPc[0], camera.position.y - star.y + origin[1] - planeta.offsetPc[1], camera.position.z - star.z + origin[2] - planeta.offsetPc[2]);
      circulo.style.opacity = 1 - smoothRange((planeta.radiusPc ?? 0) / distancia * focal, 1, 3);
    });
    if (!material.current) return;
    const { opacidad } = material.current.uniforms;
    opacidad.value = Math.min(OPACIDAD, opacidad.value + delta * OPACIDAD * 1.5);
  });
  if (!zona) return null;
  const posicion = [star.x - origin[0], star.y - origin[1], star.z - origin[2]];
  return <group position={posicion}>
    <mesh geometry={geometria} quaternion={orientacion} raycast={() => null} renderOrder={2} frustumCulled={false}>
      <shaderMaterial ref={material} uniforms={uniforms} vertexShader={VERTICE} fragmentShader={FRAGMENTO} transparent blending={THREE.AdditiveBlending} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
    </mesh>
    {sistema?.planets.map((planeta, i) => enZonaHabitable(zona, planeta.a) && <Html key={planeta.n} position={planeta.offsetPc} zIndexRange={[19, 11]} style={{ pointerEvents: 'none' }}>
      <span ref={elemento => { circulos.current[i] = elemento; }} className="zona-habitable-planeta" />
    </Html>)}
  </group>;
}
