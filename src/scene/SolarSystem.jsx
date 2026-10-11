import { Suspense, useCallback, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { AU_TO_PC, KM_TO_PC, PLANETS, PROBES, orbitalPosition, smoothRange, SUN_RADIUS_PC, solarDistance } from './scale';
import { PLANET_TEXTURES } from './planetTextures';
import StellarSurface from './StellarSurface';
import { probeVisibility } from './heliosphereScale';
import { MOON } from './solarBodies';
import { SOLAR_TEMPERATURE_K } from './stellarPhysics';

// Only the legacy probe layer still uses enlarged location markers.
function ProbeMarker({ position, color, opacityRef, pixels = 3 }) {
  const ref = useRef();
  const worldPosition = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    const mesh = ref.current;
    const distance = camera.position.distanceTo(mesh.getWorldPosition(worldPosition));
    const radius = distance * Math.tan(camera.fov * Math.PI / 360) * pixels / size.height;
    mesh.scale.setScalar(radius);
    mesh.material.opacity = opacityRef.current;
  });
  return <mesh ref={ref} position={position}>
    <sphereGeometry args={[1, 16, 12]} />
    <meshBasicMaterial color={color} transparent depthWrite={false} toneMapped={false} depthTest={false} />
  </mesh>;
}

function PlanetSurface({ url }) {
  const gl = useThree(state => state.gl);
  const configure = useCallback(texture => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
  }, [gl]);
  const map = useTexture(url, configure);
  // White avoids multiplying the original imagery by the old marker's tint.
  return <meshLambertMaterial map={map} color="white" toneMapped={false} />;
}

function PhysicalBody({ position, radiusPc, color, texture }) {
  // Map north points toward scene +Z. Longitudes/rotation remain illustrative.
  return <mesh position={position} scale={radiusPc} rotation={texture ? [Math.PI / 2, 0, 0] : undefined}>
    <sphereGeometry args={texture ? [1, 96, 64] : [1, 64, 48]} />
    {texture ? <Suspense fallback={<meshLambertMaterial color={color} toneMapped={false} />}>
        <PlanetSurface url={texture.url} />
      </Suspense> : <meshLambertMaterial color={color} toneMapped={false} />}
  </mesh>;
}

function Planet({ planet, origin }) {
  const lineRef = useRef();
  const orbitRef = useRef();
  const points = useMemo(() => {
    const array = new Float32Array(1025 * 3);
    for (let i = 0; i <= 1024; i++) array.set(orbitalPosition(planet, i / 1024 * Math.PI * 2), i * 3);
    return array;
  }, [planet]);
  useFrame(({ camera, size }) => {
    const radiusPixels = planet.au * AU_TO_PC / solarDistance(camera.position, origin)
      * size.height / (2 * Math.tan(camera.fov * Math.PI / 360));
    const opacity = smoothRange(radiusPixels, 8, 35);
    orbitRef.current.visible = opacity > 0.005;
    lineRef.current.opacity = opacity * 0.38;
  });
  return <group>
    <line ref={orbitRef}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[points, 3]} /></bufferGeometry>
      <lineBasicMaterial ref={lineRef} color="#a5afbd" transparent depthWrite={false} />
    </line>
    <PhysicalBody position={orbitalPosition(planet, planet.angle)} radiusPc={planet.radiusKm * KM_TO_PC}
      color={planet.color} texture={PLANET_TEXTURES[planet.name]} />
  </group>;
}

function Probe({ probe, origin }) {
  const groupRef = useRef();
  const opacityRef = useRef(0);
  const materialRef = useRef();
  const position = useMemo(() => new THREE.Vector3(...probe.direction).normalize().multiplyScalar(probe.au * AU_TO_PC).toArray(), [probe]);
  const points = useMemo(() => new Float32Array([0, 0, 0, ...position]), [position]);
  useFrame(({ camera }) => {
    const alpha = probeVisibility(solarDistance(camera.position, origin));
    opacityRef.current = alpha;
    groupRef.current.visible = alpha > 0.01;
    materialRef.current.opacity = alpha * 0.18;
  });
  return <group ref={groupRef}>
    <line><bufferGeometry><bufferAttribute attach="attributes-position" args={[points, 3]} /></bufferGeometry>
      <lineBasicMaterial ref={materialRef} color={probe.color} transparent depthWrite={false} /></line>
    <ProbeMarker position={position} color={probe.color} opacityRef={opacityRef} />
  </group>;
}

export default function SolarSystem({ origin }) {
  return <>
    {/* Readable shading; intensity is illustrative, radii and solar light direction are geometric. */}
    <ambientLight intensity={0.35} />
    <pointLight position={[0, 0, 0]} intensity={2} decay={0} />
    <StellarSurface position={[0, 0, 0]} radiusPc={SUN_RADIUS_PC} temperatureK={SOLAR_TEMPERATURE_K} />
    {PLANETS.map(planet => <Planet key={planet.name} planet={planet} origin={origin} />)}
    <PhysicalBody position={MOON.position} radiusPc={MOON.radiusKm * KM_TO_PC} color={MOON.color} texture={PLANET_TEXTURES.Luna} />
    {PROBES.map(probe => <Probe key={probe.name} probe={probe} origin={origin} />)}
  </>;
}
