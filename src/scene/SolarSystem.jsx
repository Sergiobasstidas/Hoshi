import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Billboard, Html, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { AU_TO_PC, KM_TO_PC, PLANETS, smoothRange, SUN_RADIUS_PC, solarDistance } from './scale';
import { PLANET_TEXTURES, bodyAxes } from './planetTextures';
import StellarSurface from './StellarSurface';
import TierraSuperficie from './TierraSuperficie';
import { cargaInicial } from '../progresoCarga';
import { MOON } from './solarBodies';
import { EPHEMERIS_DATE, planetOrbitLocal, planetPosition } from './solarEphemeris';
import OrbitLine from './OrbitLine';
import { kuiperFadeOut } from './kuiper';
import { SOLAR_TEMPERATURE_K } from './stellarPhysics';
import Moons from './Moons';
import SaturnRings from './SaturnRings';
import MoonTrail from './MoonTrail';
import ProbeTrails from './ProbeTrails';
import ProbeComets from './ProbeComets';
import ProbeModels from './ProbeModels';
import SondaEntonces from './SondaEntonces';
import { useRutasSondas } from './guiasOrbitales';
import { ARC_AU, flybyGhosts } from './probeFlybys';
import { CONTORNO_SOLAR_HASTA, UA_POR_RADIO_SOLAR, useComparacionSol, DURACION_CAMBIO_S } from './comparacionSol';

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

// Orientación real en la fecha de carga (planetTextures.js): polo y meridiano cero de la IAU.
function bodyQuaternion(texture) {
  const { x, y, z } = bodyAxes(texture, EPHEMERIS_DATE);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    new THREE.Vector3(...x), new THREE.Vector3(...y), new THREE.Vector3(...z)));
}

// Radio en pantalla (px) a partir del cual se carga la textura 4k. Una vez cargada se queda: volver a
// la 2k al alejarse un poco no ahorra nada (la 4k ya está en memoria) y se notaría el cambio.
const RADIO_CERCA_PX = 180;

// Radio en pantalla (px) desde el que la Tierra pide nubes, luces nocturnas y mapa especular; solo después de
// la carga inicial, para que no retrasen la barra. De lejos basta el mapa de día.
const RADIO_DETALLE_PX = 20;

function Superficie({ texture, cerca, detalle, luz }) {
  if (texture.nubes) {
    const version = cerca ? 'cerca' : 'lejos';
    return <TierraSuperficie luz={luz} mapas={{ dia: cerca ? texture.urlCerca : texture.url,
      ...(detalle && { nubes: texture.nubes[version], noche: texture.noche[version], especular: texture.especular[version] }) }} />;
  }
  return <PlanetSurface url={cerca ? texture.urlCerca : texture.url} />;
}

function PhysicalBody({ position, radiusPc, color, texture }) {
  // Con polo y giro declarados, la esfera muestra la cara que mira al Sol en la fecha de carga.
  const quaternion = useMemo(() => texture?.pole && texture?.spin ? bodyQuaternion(texture) : undefined, [texture]);
  const orientation = quaternion ? { quaternion } : texture ? { rotation: [Math.PI / 2, 0, 0] } : {};
  // Dirección hacia el Sol (origen del sistema solar) en el marco propio de la esfera.
  const luz = useMemo(() => {
    const haciaSol = new THREE.Vector3(...position).normalize().negate();
    if (quaternion) haciaSol.applyQuaternion(quaternion.clone().invert());
    else if (texture) haciaSol.applyEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    return haciaSol.toArray();
  }, [position, quaternion, texture]);
  const meshRef = useRef();
  const [cerca, setCerca] = useState(false);
  const [detalle, setDetalle] = useState(false);
  const centro = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    const faltaCerca = !cerca && texture?.urlCerca, faltaDetalle = !detalle && texture?.nubes && cargaInicial.lista;
    if ((!faltaCerca && !faltaDetalle) || !meshRef.current) return;
    const distancia = meshRef.current.getWorldPosition(centro).distanceTo(camera.position);
    const radioPx = radiusPc / distancia * size.height / (2 * Math.tan(camera.fov * Math.PI / 360));
    if (faltaCerca && radioPx > RADIO_CERCA_PX) setCerca(true);
    if (faltaDetalle && radioPx > RADIO_DETALLE_PX) setDetalle(true);
  });
  return <mesh ref={meshRef} position={position} scale={radiusPc} {...orientation}>
    <sphereGeometry args={texture ? [1, 96, 64] : [1, 64, 48]} />
    {texture ? <Suspense fallback={<meshLambertMaterial color={color} toneMapped={false} />}>
        {/* La 2k queda de reemplazo mientras baja la 4k: no hay parpadeo a color plano. */}
        <Suspense fallback={<Superficie texture={texture} luz={luz} cerca={false} detalle={false} />}>
          <Superficie texture={texture} luz={luz} cerca={cerca} detalle={detalle} />
        </Suspense>
      </Suspense> : <meshLambertMaterial color={color} toneMapped={false} />}
  </mesh>;
}

const orbitEndsFade = count => Float32Array.from({ length: count * 3 }, (_, k) => {
  const edge = Math.min(Math.floor(k / 3), count - 1 - Math.floor(k / 3)) / (count - 1) / 0.005;
  return Math.min(1, edge) ** 2 * (3 - 2 * Math.min(1, edge));
});

function Planet({ planet, origin, tragada }) {
  const orbitRef = useRef();
  const { center, points } = useMemo(() => planetOrbitLocal(planet.name), [planet]);
  const position = useMemo(() => planetPosition(planet.name), [planet]);
  // La trayectoria real de un período no cierra (en Neptuno quedan ≈ 0,1 UA entre los extremos, por
  // el vaivén del Sol): sus extremos, del lado opuesto al planeta, se apagan en el último 0,5 % (menos de 2° de la vuelta), sin hueco visible de lejos.
  const fade = useMemo(() => orbitEndsFade(points.length / 3), [points]);
  // Órbita dentro de la estrella que ocupa el lugar del Sol: punteada, más tenue y por encima de ella.
  useEffect(() => {
    const line = orbitRef.current;
    if (!line) return;
    if (tragada) line.computeLineDistances();
    Object.assign(line.material, { dashed: tragada, dashSize: planet.au * AU_TO_PC * 0.06, gapSize: planet.au * AU_TO_PC * 0.06, depthTest: !tragada });
    line.material.needsUpdate = true;
    line.renderOrder = tragada ? 10 : 0;
  }, [tragada, planet]);
  useFrame(({ camera, size }) => {
    const distance = solarDistance(camera.position, origin);
    const radiusPixels = planet.au * AU_TO_PC / distance
      * size.height / (2 * Math.tan(camera.fov * Math.PI / 360));
    // Las órbitas se apagan junto con el cinturón de Kuiper al alejarse.
    // Junto al planeta de un sobrevuelo se ve el arco de su órbita de entonces (ProbeTrails.jsx).
    let ghost = 0;
    for (const position of flybyGhosts.get(planet.name) ?? []) {
      const toGhost = Math.hypot(camera.position.x + origin[0] - position[0], camera.position.y + origin[1] - position[1], camera.position.z + origin[2] - position[2]);
      ghost = Math.max(ghost, 1 - smoothRange(toGhost, ARC_AU[0] * AU_TO_PC, ARC_AU[1] * AU_TO_PC));
    }
    const opacity = smoothRange(radiusPixels, 8, 35) * kuiperFadeOut(distance) * (tragada ? 0.6 : 1) * (1 - ghost);
    orbitRef.current.visible = opacity > 0.005;
    orbitRef.current.material.opacity = opacity;
  });
  return <group>
    <group position={center}><OrbitLine ref={orbitRef} points={points} colors={fade} variant="fina" /></group>
    <PhysicalBody position={position} radiusPc={planet.radiusKm * KM_TO_PC}
      color={planet.color} texture={PLANET_TEXTURES[planet.name]} />
  </group>;
}

// Contorno del Sol, siempre de frente, para comparar con estrellas de su tamaño o más chicas.
function ContornoSolar() {
  const circulo = useMemo(() => new THREE.BufferGeometry().setFromPoints(Array.from({ length: 160 }, (_, i) => {
    const angulo = i / 160 * Math.PI * 2;
    return new THREE.Vector3(Math.cos(angulo) * SUN_RADIUS_PC, Math.sin(angulo) * SUN_RADIUS_PC, 0);
  })), []);
  useEffect(() => () => circulo.dispose(), [circulo]);
  return <Billboard>
    <lineLoop geometry={circulo} renderOrder={12}>
      <lineBasicMaterial color="#ffd9a0" transparent opacity={0.55} depthTest={false} depthWrite={false} toneMapped={false} />
    </lineLoop>
    <mesh renderOrder={11} raycast={() => null}>
      <ringGeometry args={[SUN_RADIUS_PC * 0.985, SUN_RADIUS_PC * 1.03, 160]} />
      <meshBasicMaterial color="#ffd9a0" transparent opacity={0.1} depthTest={false} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
    <Html position={[0, SUN_RADIUS_PC * 1.1, 0]} center zIndexRange={[18, 10]} style={{ pointerEvents: 'none' }}>
      <span className="contorno-solar">Sol · 1 R☉</span>
    </Html>
  </Billboard>;
}

// Las rutas completas de las sondas (ProbeTrails.jsx) se encienden con «Rutas de sondas» en
// «Mostrar»; por defecto se ven solo las colas de cometa (ProbeComets.jsx) y la ruta de la sonda
// elegida (`probeSelected`, su código). `onSelect` viaja a una sonda o a un planeta de entonces;
// `onAim` gira la cámara hacia una sonda sin moverla (clic en su ruta).
// `probeThen`: la sonda en la etapa elegida de la línea de tiempo (SondaEntonces.jsx).
export default function SolarSystem({ origin, probeSelected = null, onSelect, onAim, probeThen = null }) {
  const probeRoutes = useRutasSondas();
  // Otra estrella puede ocupar el lugar del Sol, a su tamaño publicado, para comparar con las órbitas.
  const { mostrada: elegida } = useComparacionSol();
  const destino = { radio: elegida?.radiusSolar ?? 1, temperatura: elegida?.temperatureK ?? SOLAR_TEMPERATURE_K };
  // Al cambiar de estrella, radio y color pasan de uno a otro en DURACION_CAMBIO_S. El radio avanza parejo
  // (no en escala logarítmica): así el disco crece en pantalla a ritmo constante y no de golpe al final.
  const [estrella, setEstrella] = useState(destino);
  const transicion = useRef(null);
  useFrame(({ clock }) => {
    let actual = transicion.current;
    if (!actual || actual.hasta.radio !== destino.radio || actual.hasta.temperatura !== destino.temperatura) {
      if (estrella.radio === destino.radio && estrella.temperatura === destino.temperatura) return;
      actual = transicion.current = { desde: estrella, hasta: destino, inicio: clock.elapsedTime };
    }
    // Avance por tiempo transcurrido, con una curva de coseno: arranca y frena sin tirones y su rapidez
    // máxima es menor que la de smootherstep, así el crecimiento se ve más parejo en la misma duración.
    const x = Math.min(1, (clock.elapsedTime - actual.inicio) / DURACION_CAMBIO_S);
    const t = (1 - Math.cos(Math.PI * x)) / 2;
    const { desde, hasta } = actual;
    setEstrella({ radio: desde.radio + (hasta.radio - desde.radio) * t,
      temperatura: desde.temperatura + (hasta.temperatura - desde.temperatura) * t });
    if (t >= 1) transicion.current = null;
  });
  const enCambio = estrella.radio !== destino.radio || estrella.temperatura !== destino.temperatura;
  const esSol = !elegida && !enCambio;
  const radioUa = esSol ? 0 : estrella.radio * UA_POR_RADIO_SOLAR;
  return <>
    {/* Sombreado legible; intensidad ilustrativa, radios y dirección solar geométricos. */}
    <ambientLight intensity={0.35} />
    <pointLight position={[0, 0, 0]} intensity={2} decay={0} />
    {/* La misma malla y material para el Sol y la estrella que lo reemplaza: cambiar no recompila nada. */}
    <StellarSurface position={[0, 0, 0]} radiusPc={estrella.radio * SUN_RADIUS_PC} temperatureK={estrella.temperatura}
      solar={esSol} granulacionSolar={!esSol} />
    {elegida && elegida.radiusSolar <= CONTORNO_SOLAR_HASTA && <ContornoSolar />}
    {PLANETS.map(planet => <Planet key={planet.name} planet={planet} origin={origin} tragada={planet.au < radioUa} />)}
    <PhysicalBody position={MOON.position} radiusPc={MOON.radiusKm * KM_TO_PC} color={MOON.color} texture={PLANET_TEXTURES.Luna} />
    <ProbeComets origin={origin} />
    {(probeRoutes || probeSelected) && <ProbeTrails origin={origin} codes={probeRoutes ? null : [probeSelected]}
      selected={probeSelected} onSelect={onSelect} onAim={onAim} />}
    <ProbeModels origin={origin} extra={probeThen ? [probeThen] : []} />
    <SondaEntonces origin={origin} then={probeThen} />
    <MoonTrail />
    <Moons origin={origin} />
    <SaturnRings origin={origin} />
  </>;
}
