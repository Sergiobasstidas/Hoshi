import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { AU_TO_PC, smoothRange } from './scale';
import { enZonaHabitable, zonaDeEstrella } from './zonaHabitable';

// Franja plana y pareja, como la de NASA Eyes on Exoplanets: un solo turquesa translúcido entre los bordes
// de la zona conservadora, los mismos que usa la ficha, con los bordes nítidos. Sobre el negro queda en
// rgb(0, 30, 32), el tono de NASA; las estrellas de atrás se siguen viendo.
const COLOR = [0, 200 / 255, 213 / 255], OPACIDAD = 0.15;
const VERTICE = /* glsl */`
  uniform float exterior;
  varying vec2 plano;
  void main() {
    plano = position.xy / exterior;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
// Anillo entre interior y 1 (el borde exterior), con el borde suavizado solo lo que mide un píxel.
const FRAGMENTO = /* glsl */`
  uniform float interior, opacidad;
  uniform vec3 color;
  varying vec2 plano;
  void main() {
    float radio = length(plano), pixel = fwidth(radio);
    float dentro = smoothstep(interior - pixel, interior + pixel, radio) * (1.0 - smoothstep(1.0 - pixel, 1.0 + pixel, radio));
    if (dentro <= 0.0) discard;
    gl_FragColor = vec4(color, dentro * opacidad);
  }
`;

// Franja de la zona habitable alrededor de la estrella, en el plano de las órbitas.
export default function FranjaHabitable({ star, origin, fichas }) {
  const zona = useMemo(() => zonaDeEstrella(star, fichas), [star, fichas]);
  const sistema = star.planetary?.[0];
  const orientacion = useMemo(() => {
    // Sin órbitas conocidas, de frente a quien llega desde el Sol.
    const normal = new THREE.Vector3(...(sistema?.viewUp || [star.x, star.y, star.z])).normalize();
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  }, [sistema, star]);
  // Un cuadrado apenas más grande que la franja: el borde suavizado cabe entero.
  const geometria = useMemo(() => zona && new THREE.PlaneGeometry(2.02 * zona.exterior * AU_TO_PC, 2.02 * zona.exterior * AU_TO_PC), [zona]);
  const uniforms = useMemo(() => zona && ({
    exterior: { value: zona.exterior * AU_TO_PC },
    interior: { value: zona.interior / zona.exterior },
    opacidad: { value: 0 },
    color: { value: new THREE.Vector3(...COLOR) },
  }), [zona]);
  const material = useRef();
  useEffect(() => () => geometria?.dispose(), [geometria]);
  // El círculo del planeta en la zona habitable solo aparece de cerca, a pocas veces su órbita: al elegir
  // la estrella o mirar desde lejos no se ve. Se retira también en cuanto el disco del planeta se distingue
  // en pantalla, para no quedar encima. La opacidad sigue a su meta con un fundido, sin parpadeo.
  const circulos = useRef([]), opacidades = useRef([]);
  useFrame(({ camera, size }, delta) => {
    const focal = size.height / (2 * Math.tan(camera.fov * Math.PI / 360));
    sistema?.planets.forEach((planeta, i) => {
      const circulo = circulos.current[i];
      if (!circulo) return;
      const distancia = Math.hypot(camera.position.x - star.x + origin[0] - planeta.offsetPc[0], camera.position.y - star.y + origin[1] - planeta.offsetPc[1], camera.position.z - star.z + origin[2] - planeta.offsetPc[2]);
      const cerca = 1 - smoothRange(distancia / Math.max(planeta.a * AU_TO_PC, 1e-12), 3, 6);
      const meta = cerca * (1 - smoothRange((planeta.radiusPc ?? 0) / distancia * focal, 1, 3));
      const actual = opacidades.current[i] ?? 0;
      opacidades.current[i] = actual + (meta - actual) * (1 - Math.exp(-delta * 5));
      circulo.style.opacity = opacidades.current[i].toFixed(3);
    });
    if (!material.current) return;
    const { opacidad } = material.current.uniforms;
    opacidad.value = Math.min(OPACIDAD, opacidad.value + delta * OPACIDAD * 1.5);
  });
  if (!zona) return null;
  const posicion = [star.x - origin[0], star.y - origin[1], star.z - origin[2]];
  return <group position={posicion}>
    <mesh geometry={geometria} quaternion={orientacion} raycast={() => null} renderOrder={2} frustumCulled={false}>
      <shaderMaterial ref={material} uniforms={uniforms} vertexShader={VERTICE} fragmentShader={FRAGMENTO} transparent side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
    </mesh>
    {sistema?.planets.map((planeta, i) => enZonaHabitable(zona, planeta.a) && <Html key={planeta.n} position={planeta.offsetPc} zIndexRange={[19, 11]} style={{ pointerEvents: 'none' }}>
      <span ref={elemento => { circulos.current[i] = elemento; }} className="zona-habitable-planeta" />
    </Html>)}
  </group>;
}
