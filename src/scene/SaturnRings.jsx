import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { KM_TO_PC } from './scale';
import { planetPosition } from './solarEphemeris';
import { SATURN_RING_BASIS } from './moonEphemeris';
import { sampleRingParticles } from './ringParticles';

// Partículas de los anillos en el plano ecuatorial de Saturno (véase ringParticles.js).
// Cobertura: cada punto cubre S / (N · A) de su píxel, con S el área efectiva del anillo, N los
// puntos y A el área del anillo que cubre un píxel; así la cobertura por píxel sigue 1 − e^(−τ) a
// cualquier distancia (y el anillo tapa al planeta en esa proporción), y de cerca (menos de un
// punto por píxel) cada punto se ve suelto. La cara no
// iluminada se aproxima con la luz que atraviesa: τ e^(−τ) / (1 − e^(−τ)). La sombra del
// planeta usa la esfera dibujada (radio medio). Ni el tamaño de los puntos ni su color son medidas.
const SATURN_RADIUS_KM = 58232;
const OUTER_KM = 140700;
// Píxeles que ocupa en promedio cada punto (perfil gaussiano de 2 px de lado).
const POINT_PIXELS = 2, POINT_COVERAGE = 1.6;

const cameraLocal = new Vector3();

export default function SaturnRings({ origin }) {
  const [profile, setProfile] = useState(null);
  useEffect(() => {
    let active = true;
    fetch('/data/saturn_rings.json').then(response => response.ok ? response.json() : null)
      .then(data => { if (active && data) setProfile(data); }).catch(() => {});
    return () => { active = false; };
  }, []);
  return profile && <RingParticles profile={profile} origin={origin} />;
}

function RingParticles({ profile, origin }) {
  const points = useRef(), material = useRef(), warmup = useRef(3);
  const center = useMemo(() => planetPosition('Saturno'), []);
  const particles = useMemo(() => sampleRingParticles(profile), [profile]);
  // Local: X = nodo del ecuador de Saturno sobre el ecuador ICRF, Z = polo (normal del anillo).
  const rotation = useMemo(() => {
    const [x, y, z] = SATURN_RING_BASIS.map(axis => new Vector3(...axis));
    return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
  }, []);
  const inverse = useMemo(() => rotation.clone().invert(), [rotation]);
  const uniforms = useMemo(() => {
    // Del planeta hacia el Sol (el Sol es el origen de coordenadas solares), en el marco local.
    const sun = new Vector3(...center).negate().normalize().applyQuaternion(inverse);
    return {
      sunDirection: { value: sun }, planetRadius: { value: SATURN_RADIUS_KM },
      litSide: { value: 1 }, gain: { value: 1 }, pixelRatio: { value: 1 },
    };
  }, [center, inverse]);

  useFrame(({ camera, gl, size }) => {
    cameraLocal.set(camera.position.x + origin[0] - center[0], camera.position.y + origin[1] - center[1], camera.position.z + origin[2] - center[2]);
    const distance = cameraLocal.length();
    const pixelAngle = 2 * Math.tan(camera.fov * Math.PI / 360) / (size.height * gl.getPixelRatio());
    // Sin anillos cuando ocupan menos de un par de píxeles.
    // Los primeros cuadros se dibujan aunque no se vean: compilan el sombreador y suben los puntos
    // a la GPU durante la carga, no al llegar a Saturno.
    points.current.visible = OUTER_KM * KM_TO_PC / distance / pixelAngle > 2 || warmup.current-- > 0;
    if (!points.current.visible) return;
    cameraLocal.applyQuaternion(inverse);
    const values = material.current.uniforms;
    // Cara que ve la cámara: la del Sol (1) o la opuesta (0).
    values.litSide.value = Math.sign(cameraLocal.z) === Math.sign(values.sunDirection.value.z) ? 1 : 0;
    // S / (N · θ² · cobertura), con θ el ángulo de un píxel: el shader multiplica por μ / d² (km).
    // Con el anillo pequeño en pantalla, cientos de puntos caían en cada píxel y la llegada a Saturno
    // bajaba a 15 cuadros/s: se dibujan como mucho unos 6 puntos por píxel de anillo.
    const ringPixels = OUTER_KM * KM_TO_PC / distance / pixelAngle;
    const drawn = Math.min(particles.count, Math.max(20000, Math.round(6 * Math.PI * ringPixels ** 2)));
    points.current.geometry.setDrawRange(0, drawn);
    values.gain.value = particles.area / (drawn * pixelAngle ** 2 * POINT_COVERAGE);
    values.pixelRatio.value = gl.getPixelRatio();
  });

  return <group position={center} quaternion={rotation}>
    <points ref={points} scale={KM_TO_PC} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[particles.position, 3]} />
        <bufferAttribute attach="attributes-color" args={[particles.color, 3]} />
        <bufferAttribute attach="attributes-tau" args={[particles.tau, 1]} />
      </bufferGeometry>
      <shaderMaterial ref={material} transparent depthWrite={false} toneMapped={false} uniforms={uniforms}
        vertexShader={`
          uniform vec3 sunDirection;
          uniform float planetRadius;
          uniform float litSide;
          uniform float gain;
          uniform float pixelRatio;
          attribute vec3 color;
          attribute float tau;
          varying vec3 tint;
          varying float coverage;
          #include <common>
          #include <logdepthbuf_pars_vertex>
          void main() {
            vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * viewPosition;
            gl_PointSize = ${POINT_PIXELS.toFixed(1)} * pixelRatio;
            // Distancia en km (la escala del objeto pasa de km a pc) e inclinación de la mirada.
            float distanceKm = length(viewPosition.xyz) / ${KM_TO_PC.toExponential(8)};
            vec3 normalView = normalize(normalMatrix * vec3(0.0, 0.0, 1.0));
            float mu = max(abs(dot(normalView, normalize(viewPosition.xyz))), 0.02);
            float intensity = min(1.0, gain * mu / (distanceKm * distanceKm));
            float opacity = 1.0 - exp(-tau);
            float transmitted = tau * exp(-tau) / max(opacity, 1e-6);
            float along = dot(position, sunDirection);
            float shadow = along < 0.0 && length(position - along * sunDirection) < planetRadius ? 0.04 : 1.0;
            coverage = intensity;
            tint = color * shadow * mix(transmitted, 1.0, litSide);
            #include <logdepthbuf_vertex>
          }`}
        fragmentShader={`
          varying vec3 tint;
          varying float coverage;
          #include <logdepthbuf_pars_fragment>
          void main() {
            vec2 p = gl_PointCoord * 2.0 - 1.0;
            float r2 = dot(p, p);
            if (r2 > 1.0) discard;
            gl_FragColor = vec4(tint, coverage * exp(-r2 * 2.5));
            #include <logdepthbuf_fragment>
          }`} />
    </points>
  </group>;
}
