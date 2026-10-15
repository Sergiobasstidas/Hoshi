import { Suspense, useCallback, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { AU_TO_PC, KM_TO_PC, PLANETS, smoothRange, SUN_RADIUS_PC, solarDistance } from './scale';
import { PLANET_TEXTURES } from './planetTextures';
import StellarSurface from './StellarSurface';
import { MOON } from './solarBodies';
import { planetOrbit, planetPosition } from './solarEphemeris';
import OrbitLine from './OrbitLine';
import { SOLAR_TEMPERATURE_K } from './stellarPhysics';
import ProbeTrails from './ProbeTrails';
import ProbeComets from './ProbeComets';

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
  // El blanco evita multiplicar la imagen original por el tinte del marcador anterior.
  return <meshLambertMaterial map={map} color="white" toneMapped={false} />;
}

function PhysicalBody({ position, radiusPc, color, texture }) {
  // El norte del mapa apunta a +Z de escena. Longitudes y rotación siguen siendo ilustrativas.
  return <mesh position={position} scale={radiusPc} rotation={texture ? [Math.PI / 2, 0, 0] : undefined}>
    <sphereGeometry args={texture ? [1, 96, 64] : [1, 64, 48]} />
    {texture ? <Suspense fallback={<meshLambertMaterial color={color} toneMapped={false} />}>
        <PlanetSurface url={texture.url} />
      </Suspense> : <meshLambertMaterial color={color} toneMapped={false} />}
  </mesh>;
}

function Planet({ planet, origin }) {
  const orbitRef = useRef();
  const points = useMemo(() => planetOrbit(planet.name), [planet]);
  useFrame(({ camera, size }) => {
    const radiusPixels = planet.au * AU_TO_PC / solarDistance(camera.position, origin)
      * size.height / (2 * Math.tan(camera.fov * Math.PI / 360));
    const opacity = smoothRange(radiusPixels, 8, 35);
    orbitRef.current.visible = opacity > 0.005;
    orbitRef.current.material.opacity = opacity;
  });
  return <group>
    <OrbitLine ref={orbitRef} points={points} variant="fina" />
    <PhysicalBody position={planetPosition(planet.name)} radiusPc={planet.radiusKm * KM_TO_PC}
      color={planet.color} texture={PLANET_TEXTURES[planet.name]} />
  </group>;
}

// `probeRoutes`: rutas completas de las sondas desde el lanzamiento (ProbeTrails.jsx), guardadas
// para un botón futuro; por defecto se ven solo las colas de cometa (ProbeComets.jsx).
export default function SolarSystem({ origin, probeRoutes = false }) {
  return <>
    {/* Sombreado legible; intensidad ilustrativa, radios y dirección solar geométricos. */}
    <ambientLight intensity={0.35} />
    <pointLight position={[0, 0, 0]} intensity={2} decay={0} />
    <StellarSurface position={[0, 0, 0]} radiusPc={SUN_RADIUS_PC} temperatureK={SOLAR_TEMPERATURE_K} />
    {PLANETS.map(planet => <Planet key={planet.name} planet={planet} origin={origin} />)}
    <PhysicalBody position={MOON.position} radiusPc={MOON.radiusKm * KM_TO_PC} color={MOON.color} texture={PLANET_TEXTURES.Luna} />
    <ProbeComets origin={origin} />
    {probeRoutes && <ProbeTrails origin={origin} />}
  </>;
}
