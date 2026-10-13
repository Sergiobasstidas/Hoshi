import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import stellarPhysics from '../data/processed/stellar_physics.json';
import { PUBLISHED_STELLAR_PHYSICS } from './scene/publishedStellarPhysics.js';
import StarField from './scene/StarField';
import SolarSystem from './scene/SolarSystem';
import OortCloud from './scene/OortCloud';
import Heliosphere from './scene/Heliosphere';
import { HELIOSPHERE_RADIUS_PC, HELIOSPHERE_VIEW_DISTANCE_PC } from './scene/heliosphereScale';
import VisualGuides from './scene/VisualGuides';
import FreeFlight from './scene/FreeFlight';
import StarAim from './scene/StarAim.jsx';
import { canAimStar } from './scene/starHeading';
import { AU_TO_PC, BODY_CAMERA_NEAR_PC, ECLIPTIC_UP, LIGHT_YEAR_PC, MAX_VIEW_DISTANCE_PC, OORT_OUTER_PC, PLANETS, PROBES, SCENE_FAR_PC, SUN_RADIUS_PC, VIEWS, orbitalPosition } from './scene/scale';
import { SOLAR_BODIES, MOON, bodyView } from './scene/solarBodies';
import { PLANET_TEXTURES, PLANET_TEXTURE_SOURCE, PLANET_TEXTURE_LICENSE } from './scene/planetTextures';
import { identifyStellarTargets, stellarTargets, WR140_ID } from './scene/stellarTargets';
import BinarySystem from './scene/BinarySystem';
import { BINARY_EPOCH, BINARY_STATE, WR140_ORBIT } from './scene/binaryOrbit';
import './App.css';
import StarSearch from './StarSearch';
import BarraDistancia from './BarraDistancia';
import DialVelocidad from './DialVelocidad';
import DialDistancia from './DialDistancia';
import { destinoDesdeBarra } from './scene/escalaNavegacion.js';
import MilkyWay from './scene/MilkyWay';
import { GALAXY_CENTER, galaxyView } from './scene/galaxy.js';
import PulsarMap from './scene/PulsarMap';
import { PULSARS } from './scene/pulsarData';
import KuiperBelt from './scene/KuiperBelt';
import { KUIPER_VIEW } from './scene/kuiper';
import CameraNavigation from './scene/CameraNavigation';
import { PULSAR_VIEW } from './scene/navigation';
import { CURATED_STARS } from './scene/curatedStars';
import CompanionStars from './scene/CompanionStars';
import { BINARY_MODEL_DATE, buildStarSystems } from './scene/visualBinary.js';
import { JOURNEY_TIME_SCALE } from './scene/starJourney.js';
import PlanetarySystems from './scene/PlanetarySystem';
import { ARRIVAL_FRAME_FACTOR, EXOPLANET_EPOCH, buildPlanetarySystems, describeAssumptions, describePlanet, hostPhysics } from './scene/exoplanetOrbit.js';

// El catálogo pesa más que el resto de la aplicación: se descarga aparte para que
// el sistema solar y la interfaz aparezcan antes. Hasta entonces solo hay curados.
function buildCatalogue({ catalogue, systems, planets }) {
  // Radio y temperatura de las anfitrionas de exoplanetas publicados en el archivo de la
  // NASA: preceden a la estimación fotométrica.
  const hostPhysicsById = new Map((planets?.systems || []).map(system => [system.i, hostPhysics(system.st)]));
  const stars = identifyStellarTargets([...catalogue, ...CURATED_STARS])
    .map(star => ({ ...star, physics: PUBLISHED_STELLAR_PHYSICS[star.i] || hostPhysicsById.get(star.i) || stellarPhysics[star.i] || null }));
  const STELLAR_TARGETS = stellarTargets(stars);
  const starsById = new Map(stars.map(star => [star.i, star]));
  // Coloca las componentes de los sistemas múltiples; puede situar sobre su órbita a
  // una compañera que ya era un registro del catálogo.
  const BINARY_SYSTEMS = buildStarSystems(systems, starsById);
  for (const system of BINARY_SYSTEMS) system.star.system = system;
  // Sistemas planetarios, después de recolocar compañeras: usan la posición final de su estrella.
  const PLANETARY_SYSTEMS = buildPlanetarySystems(planets, starsById);
  for (const system of PLANETARY_SYSTEMS) (system.star.planetary ||= []).push(system);
  return { stars, starsById, STELLAR_TARGETS, BINARY_SYSTEMS, PLANETARY_SYSTEMS,
    NAVIGATION_TARGETS: [...SOLAR_BODIES, ...STELLAR_TARGETS],
    BINARY_BACKGROUND: stars.filter(star => star.i !== WR140_ID) };
}
const EMPTY_CATALOGUE = { catalogue: [], systems: {}, planets: null };
// Resumen de una componente para la ficha.
const significant = value => value.toLocaleString('es-CL', { maximumSignificantDigits: 3 });
const period = days => days < 365.25 ? `${significant(days)} días` : `${significant(days / 365.25)} años`;
const describeComponent = component => `${component.name}: ${component.pair.k === 'o'
  ? `órbita de ${period(component.pair.p)}, a ${significant(component.separationAu)} UA`
  : `par ancho, ${significant(component.separationAu)} UA proyectadas`}${component.pair.m1 && component.pair.m2
  ? `, masas ${component.pair.mc === 'pub' ? '' : '≈ '}${component.pair.m1.toLocaleString('es-CL')} y ${component.pair.m2.toLocaleString('es-CL')} M☉${component.pair.mc === 'pub' ? ` (${component.pair.ms})` : ''}` : ''}`;
const SCALE_VIEWS = [VIEWS[0], KUIPER_VIEW, { id: 'heliosphere', label: 'Heliosfera', distance: HELIOSPHERE_VIEW_DISTANCE_PC }, ...VIEWS.slice(1)];
const SOLAR_ORIGIN = [0, 0, 0];
const EARTH = SOLAR_BODIES.find(body => body.name === 'Tierra');
// Artículo del nombre en el título del visor: «al Sol», «a la Tierra», «a Marte», «a Sirius».
const distanceTitle = name => `Distancia ${name === 'Sol' || name === 'centro galáctico' ? 'al' : name === 'Tierra' || name === 'Luna' ? 'a la' : 'a'} ${name}`;
const START_DIRECTION = new THREE.Vector3(...orbitalPosition({au:1,inclinationDeg:0,ascendingNodeDeg:0},-Math.PI/2)).normalize().multiplyScalar(0.85).addScaledVector(new THREE.Vector3(...ECLIPTIC_UP),0.52).normalize();
const INITIAL_VIEW = bodyView(EARTH);
const START_POSITION = START_DIRECTION.clone().multiplyScalar(INITIAL_VIEW.distance).add(new THREE.Vector3(...EARTH.position)).toArray();

function SceneReady() {
  const frames = useRef(0);
  useFrame(() => {
    if (++frames.current === 2) document.getElementById('boot-loader')?.remove();
  });
  return null;
}


export default function App() {
  const [catalogue, setCatalogue] = useState(EMPTY_CATALOGUE);
  const [catalogueStatus, setCatalogueStatus] = useState('loading');
  useEffect(() => {
    let active = true;
    // Los planetas viajan aparte del bundle; si fallan, el catálogo se muestra sin ellos.
    const planets = fetch('/data/exoplanets.json').then(response => response.ok ? response.json() : null).catch(() => null);
    Promise.all([import('../data/processed/stars_15pc.json'), import('../data/processed/star_systems.json'), planets])
      .then(([stars, systems, planets]) => { if (active) { setCatalogue({ catalogue: stars.default, systems: systems.default, planets }); setCatalogueStatus('ready'); } })
      .catch(() => { if (active) setCatalogueStatus('error'); });
    return () => { active = false; };
  }, []);
  const { stars, starsById, STELLAR_TARGETS, NAVIGATION_TARGETS, BINARY_BACKGROUND, BINARY_SYSTEMS, PLANETARY_SYSTEMS } = useMemo(() => buildCatalogue(catalogue), [catalogue]);
  const [view, setView] = useState(INITIAL_VIEW);
  const [freeFlight, setFreeFlight] = useState(false);
  const [traveling, setTraveling] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [velocidadSolicitada, setVelocidadSolicitada] = useState(null);
  const [showBodyPanel, setShowBodyPanel] = useState(false);
  const [showPulsars, setShowPulsars] = useState(false);
  const [galaxyStatus, setGalaxyStatus] = useState('idle');
  const [aimTarget, setAimTarget] = useState(null);
  const [inspectedTarget, setInspectedTarget] = useState(null);
  const [departureBody, setDepartureBody] = useState(null);
  const cameraRef = useRef();
  const releaseAim = useCallback(() => setAimTarget(null), []);
  const overlayRef = useRef();
  const controlsRef = useRef();
  const transitionRef = useRef();
  const focusedBody = freeFlight ? null : view.body;
  const binaryBody = view.body?.kind === 'system' ? view.body : null;
  const panelBody = focusedBody || binaryBody || (view.body?.kind === 'star' ? view.body : null);
  const bodyTexture = PLANET_TEXTURES[panelBody?.name];
  const stellarBody = view.body?.kind === 'star' ? view.body : null;
  const curatedStellarBody = stellarBody?.star.dataOrigin === 'curated';
  // Planeta de otro sistema: el origen local pasa al planeta y su estrella sigue a escala.
  const exoplanetBody = view.body?.kind === 'exoplanet' ? view.body : null;
  const hostStar = stellarBody?.star || exoplanetBody?.star;
  const localPlanets = (hostStar?.planetary || []).flatMap(system => system.planets.filter(planet => planet.body).map(planet => planet.body));
  const hostName = exoplanetBody && (hostStar.n || exoplanetBody.system.name);
  const origin = binaryBody?.position || stellarBody?.position || exoplanetBody?.position || SOLAR_ORIGIN;
  const navigate = (destination, options = {}) => {
    const camera = cameraRef.current;
    if (!camera) return;
    const start = camera.position.toArray().map((v, i) => v + origin[i]);
    const rotation = camera.quaternion.toArray();
    transitionRef.current = null;
    releaseAim();
    setFreeFlight(false);
    setTraveling(true);
    setVelocidadSolicitada(null);
    setDepartureBody(view.body || departureBody);
    // Toda vista sin vertical propia devuelve la cámara a la normal eclíptica.
    setView({ ...destination, target: destination.target || SOLAR_ORIGIN, up: destination.up || ECLIPTIC_UP,
      journey: { start, rotation, ...options } });
    document.activeElement?.blur();
  };
  const visitBody = (body, fromSearch = false) => {
    setShowPulsars(false);
    setShowBodyPanel(fromSearch);
    setInspectedTarget(fromSearch && body.kind === 'star'
      ? {kind:'star',text:body.name,star:body.star,catalogueId:body.star.i,position:body.position} : null);
    navigate(bodyView(body), { arriveFree: fromSearch });
  };
  const focusBody = body => { visitBody(body); if (body.kind === 'exoplanet') setShowBodyPanel(true); };
  // Estrella como destino: encuadra su sistema (compañeras o planetas) y, si tiene
  // planetas, llega mirando el plano orbital abierto en vez de canto.
  const starBody = (star, name, identifiers) => ({
    kind:'star',name,star,position:[star.x,star.y,star.z],
    radiusKm:star.physics?.radiusKm,source:star.physics?.source || star.source,distanceSource:star.distanceSource,
    companionViewDistance:Math.max((star.system?.framePc || 0) * 3.2, ...(star.planetary || []).map(system => system.framePc * ARRIVAL_FRAME_FACTOR)),
    viewDirection:star.planetary?.[0].viewDirection, viewUp:star.planetary?.[0].viewUp,
    identifiers,
  });
  const framePulsars = () => {
    setShowPulsars(true); setShowBodyPanel(false); setInspectedTarget(null);
    navigate(PULSAR_VIEW, { duration: 4 * JOURNEY_TIME_SCALE });
  };
  const frameGalaxy = (edgeOn = false) => {
    setShowPulsars(false); setShowBodyPanel(false); setInspectedTarget(null);
    navigate(galaxyView(edgeOn), { duration: 8 * JOURNEY_TIME_SCALE });
  };
  const viajarDesdeBarra = valor => {
    if (!cameraRef.current) return;
    setShowPulsars(false); setShowBodyPanel(false); setInspectedTarget(null);
    navigate(destinoDesdeBarra(valor, cameraRef.current.position.toArray(), origin), {arriveFree:freeFlight, duration:2});
  };
  const toggleFlight = () => {
    if (freeFlight) { aimAtSun(); return; }
    transitionRef.current = null;
    setTraveling(false);
    releaseAim();
    setFreeFlight(true);
  };
  const aimAtStar = label => {
    if (!cameraRef.current || !canAimStar(cameraRef.current.position, origin)) return;
    transitionRef.current = null;
    setTraveling(false);
    setAimTarget(label);
    setInspectedTarget(label);
    setFreeFlight(true);
  };
  const aimAtSun = () => {
    const camera = cameraRef.current;
    if (!camera) return;
    setShowPulsars(false);
    setShowBodyPanel(false);
    setInspectedTarget(null);
    navigate({id:'solar-aim',target:SOLAR_ORIGIN,
      distance:Math.hypot(...camera.position.toArray().map((v,i)=>v+origin[i]))}, { headingOnly:true });
  };
  const inspectSurface = () => {
    const physics = aimTarget.star.physics;
    const body = { kind: 'star', name: aimTarget.text, position: aimTarget.position,
      star: aimTarget.star, radiusKm: physics.radiusKm, source: physics.source };
    releaseAim();
    visitBody(body);
  };
  const visitSearchResult = result => {
    const star=starsById.get(result.id);
    if(!star || !cameraRef.current)return;
    setShowPulsars(false);
    const body=STELLAR_TARGETS.find(b=>b.catalogueId===star.i) || (star.n==='Sol'?SOLAR_BODIES[0]
      : starBody(star, star.n||result.aliases[0], result.aliases.slice(0, 10).join(' · ') + (result.aliases.length > 10 ? ' · …' : '')));
    if (star.n === 'Sol' || star.n === 'Sun') { aimAtSun(); return; }
    visitBody(body, true);
  };
  const labels = useMemo(() => [
    { kind: 'moon', text: 'Luna · 384.400 km de la Tierra', position: MOON.position, width:230, body:MOON },
    { kind: 'sun', text: 'Sol', position: [0, 0, 0], width: 34, body: SOLAR_BODIES[0] },
    ...PLANETS.map(p => ({ kind: 'planet', au: p.au, text: p.name,
      position: orbitalPosition(p, p.angle), width: 145, color: p.color, body: SOLAR_BODIES.find(b => b.name === p.name) })),
    ...PROBES.filter(p => p.name.startsWith('Voyager')).map(p => ({ kind: 'probe', text: `${p.name} · ${p.au} UA`,
      position: new THREE.Vector3(...p.direction).normalize().multiplyScalar(p.au * AU_TO_PC).toArray(), width: 165, color: p.color })),
    { kind: 'oort', text: 'Nube de Oort', position: [-OORT_OUTER_PC * 0.8, 0, 0], width: 125 },
    { kind: 'kuiper', text: 'Cinturón de Kuiper · 30–50 UA', position: orbitalPosition({au:45,inclinationDeg:0,ascendingNodeDeg:0},2.6), width: 225 },
    { kind: 'heliosphere', text: 'Heliosfera · ≈120 UA', position: [-HELIOSPHERE_RADIUS_PC * 0.72, 0, HELIOSPHERE_RADIUS_PC * 0.7], width: 185, color: '#80b6c0' },
    ...stars.filter(s => s.n && s.n !== 'Sol' && s.n !== 'Sun').sort((a,b) => a.d - b.d)
      .map(s => ({ kind: 'star', star: s, catalogueId: s.i, text: s.n, position: [s.x, s.y, s.z], width: s.n.length * 6 + 10,
        body: STELLAR_TARGETS.find(target => target.catalogueId === s.i) })),
  ], [stars, STELLAR_TARGETS]);
  // Objetivo del visor de distancia: el rumbo fijado; en vuelo libre, la estrella
  // inspeccionada o el Sol; en las demás vistas, lo que queda centrado.
  const distanceTarget = aimTarget?.kind === 'star' ? { name: aimTarget.text, position: aimTarget.position }
    : freeFlight ? inspectedTarget ? { name: inspectedTarget.text, position: inspectedTarget.position } : null
    : view.body ? { name: view.body.name, position: view.body.position }
    : view.id === 'galaxy' || view.centro === 'galaxia' ? { name: 'centro galáctico', position: GALAXY_CENTER }
    : view.id === 'escala' ? { name: 'Tierra', position: EARTH.position } : null;
  const orbitTarget = (view.target || SOLAR_ORIGIN).map((v,i)=>v-origin[i]);
  return <main className="hoshi">
    <Canvas camera={{ position: START_POSITION, up: ECLIPTIC_UP, fov: 50, near: BODY_CAMERA_NEAR_PC, far: SCENE_FAR_PC }}
      dpr={[1, 1.5]} gl={{ antialias: true, logarithmicDepthBuffer: true }}>
      <SceneReady />
      <color attach="background" args={['#020305']} />
      {freeFlight ? <FreeFlight velocidadSolicitada={velocidadSolicitada} onSpeedChange={setSpeed} initialBody={view.body} origin={origin} onManualLook={releaseAim} aimTarget={aimTarget} inspectedTarget={inspectedTarget} /> : !traveling && <OrbitControls ref={controlsRef} target={orbitTarget}
        minDistance={view.minDistance ?? SUN_RADIUS_PC * 1.02} maxDistance={MAX_VIEW_DISTANCE_PC}
        enablePan={false} enableDamping dampingFactor={0.12} rotateSpeed={0.55} zoomSpeed={1.35}
        onStart={() => { transitionRef.current = null; }} />}
      <CameraNavigation view={view} showPulsars={showPulsars} transitionRef={transitionRef} origin={origin} onComplete={arriveFree => { setTraveling(false); setFreeFlight(arriveFree); document.activeElement?.blur(); }} />
      <StarAim target={aimTarget} origin={origin} onRelease={releaseAim} cameraRef={cameraRef} />
      <MilkyWay origin={origin} onStatus={setGalaxyStatus} muted={showPulsars} />
      {showPulsars && <PulsarMap origin={origin} />}
      <StarField gain={showPulsars ? 0.18 : 1} stars={binaryBody || departureBody?.kind === 'system' ? BINARY_BACKGROUND : stars} origin={origin}
        focusedStar={inspectedTarget?.star || hostStar} departureStar={departureBody?.star} />
      {binaryBody && <BinarySystem />}
      {!binaryBody && <CompanionStars systems={BINARY_SYSTEMS} origin={origin} />}
      {!binaryBody && <PlanetarySystems systems={PLANETARY_SYSTEMS} origin={origin} onSelect={focusBody} />}
      {!binaryBody && departureBody?.kind === 'system' && <BinarySystem position={departureBody.position.map((v,i)=>v-origin[i])} />}
      {/* Conservar el escenario de partida al cambiar el origen local a una estrella. */}
      <group position={origin.map(v=>-v)}>
        <OortCloud origin={origin} /><SolarSystem origin={origin} /><KuiperBelt origin={origin} /><Heliosphere origin={origin} />
      </group>
      <VisualGuides overlayRef={overlayRef} labels={labels} focusedBody={panelBody} origin={origin} binary={Boolean(binaryBody)} aimTarget={aimTarget} distanceTarget={distanceTarget?.position} />
    </Canvas>
    <div ref={overlayRef} className="scene-overlay">
      <StarSearch onSelect={visitSearchResult} />
      <BarraDistancia onViajar={viajarDesdeBarra} />
      <div className="visores-vuelo"><DialDistancia titulo={distanceTitle(distanceTarget?.name || 'Sol')} />
      <DialVelocidad velocidad={speed} activo={freeFlight} viajando={traveling} onActivar={toggleFlight}
        onCambiar={valor=>{setSpeed(valor);setVelocidadSolicitada({valor});}} />
      </div>
      <details className="distance-panel creditos-hoshi">
        <summary className="eyebrow marca-hoshi" aria-label="Hoshi: ver créditos">H O S H I</summary>
        <div className="creditos-contenido">
          <p>© 2026 Sergio Bastidas</p>
          <p>Vía Láctea: ESA/Gaia/DPAC · Stefan Payne-Wardenaar.</p>
          <p>Adaptación con volumen de una representación galáctica.</p>
          <a href="https://www.cosmos.esa.int/web/gaia/milky-way" target="_blank" rel="noreferrer">Fuente original</a>
          {' · '}<a href="https://creativecommons.org/licenses/by-sa/3.0/igo/" target="_blank" rel="noreferrer">CC BY-SA 3.0 IGO</a>
        </div>
      </details>
      <nav className="scale-navigation" aria-label="Explorar escalas">
        {SCALE_VIEWS.map(option => <button key={option.id} onClick={() => { setShowPulsars(false); setShowBodyPanel(false); setInspectedTarget(null); navigate(option); }}>
          {option.label}
        </button>)}
        <button aria-pressed={view.id === 'galaxy'} onClick={() => frameGalaxy()}>Vía Láctea</button>
        <button aria-pressed={showPulsars} onClick={() => {
          if (showPulsars) { setShowPulsars(false); transitionRef.current=null; setTraveling(false); setFreeFlight(true); }
          else framePulsars();
        }}>Mapa de púlsares</button>
        <button aria-pressed={freeFlight} onClick={toggleFlight}>Vuelo libre</button>
        <button onClick={aimAtSun}>Volver al Sol</button>
      </nav>
      {catalogueStatus === 'loading' && <div className="galaxy-loading" role="status">Cargando el catálogo de estrellas…</div>}
      {catalogueStatus === 'error' && <div className="galaxy-loading" role="status">No se pudo cargar el catálogo de estrellas. Recarga para reintentar.</div>}
      {galaxyStatus === 'loading' && <div className="galaxy-loading" role="status">Cargando la Vía Láctea…</div>}
      {galaxyStatus === 'error' && <div className="galaxy-loading" role="status">No se pudo cargar la galaxia. Recarga para reintentar.</div>}
      {showPulsars && <aside className="pulsar-legend">
        <strong>Los 14 púlsares del mapa de Voyager</strong>
        <span>Conexiones desde el Sol · distancias estimadas · posiciones de catálogo</span>
        <button onClick={framePulsars}>Encuadrar mapa</button>
        <details><summary>Identificación y distancias</summary>
          <div className="pulsar-list">{PULSARS.map(p=><div key={p.id}>{p.bname} · {p.id} · ≈{Math.round(p.distancePc*3.26156).toLocaleString('es-CL')} años luz</div>)}</div>
          <p>Los trazos discontinuos son visuales, no cifras binarias. Las distancias tienen incertidumbre; no son las longitudes del grabado de 1977.</p>
          <a href="https://science.nasa.gov/mission/voyager/golden-record-cover/" target="_blank" rel="noreferrer">NASA: mapa original</a> · <a href="https://www.atnf.csiro.au/research/pulsar/psrcat/" target="_blank" rel="noreferrer">Catálogo ATNF</a>
        </details>
      </aside>}
      <label className="body-selector">Acercarse a
        <select aria-label="Acercarse a un cuerpo" value={focusedBody?.name || ''} onChange={event => {
          const name = event.target.value;
          const body = localPlanets.find(b => b.name === name) || (exoplanetBody && name === hostName ? starBody(hostStar, hostName) : NAVIGATION_TARGETS.find(b => b.name === name));
          if (body) focusBody(body);
        }}>
          <option value="" disabled>Elegir cuerpo</option>
          {stellarBody && <option value={stellarBody.name}>{stellarBody.name}</option>}
          {exoplanetBody && <option value={hostName}>{hostName}</option>}
          {localPlanets.length > 0 && <optgroup label="Planetas de este sistema">
            {localPlanets.map(body => <option key={body.name} value={body.name}>{body.name}</option>)}
          </optgroup>}
          {NAVIGATION_TARGETS.map(body => <option key={body.name} value={body.name}>{body.name}</option>)}
        </select>
      </label>
      {aimTarget && aimTarget.kind !== 'sun' && <>
        <div className="aim-reticle" aria-hidden="true" />
        {!(showBodyPanel && panelBody) && <aside className="aim-panel" aria-label="Objetivo de vuelo">
          <strong>Objetivo: {aimTarget.text}</strong>
          <span data-aim-distance />
          <span>W / S: acercarse / alejarse · Rueda: velocidad</span>
          <span>Frenado automático · {aimTarget.star.physics ? 'límite sobre la superficie' : 'radio desconocido: marcador'}</span>
          {aimTarget.star.physics && <>
            <span>Radio {aimTarget.star.physics.status === 'published' ? 'publicado' : 'estimado'}: {aimTarget.star.physics.radiusSolar.toLocaleString('es-CL', { maximumSignificantDigits: 3 })} R☉</span>
            <span>Temperatura {aimTarget.star.physics.status === 'published' ? 'publicada' : 'estimada'}: {Math.round(aimTarget.star.physics.temperatureK).toLocaleString('es-CL')} K</span>
            <button onClick={inspectSurface}>Ver superficie</button>
          </>}
          <button onClick={releaseAim}>Soltar objetivo · Esc</button>
        </aside>}
      </>}
      {showBodyPanel && panelBody && <aside className="body-panel">
        <button className="panel-close" aria-label="Cerrar información" onClick={() => setShowBodyPanel(false)}>×</button>
        <strong>{panelBody.name}</strong>
        {stellarBody?.star.physics && <div>Radio y temperatura {stellarBody.star.physics.status === 'published' ? 'publicados' : 'estimados'} · {Math.round(stellarBody.star.physics.temperatureK).toLocaleString('es-CL')} K · textura ilustrativa</div>}
        {stellarBody?.star.physics?.status === 'published' && <div>Radio: {stellarBody.star.physics.radiusSolar}{stellarBody.star.physics.radiusUncertaintySolar ? ` ± ${stellarBody.star.physics.radiusUncertaintySolar}` : ''} R☉{stellarBody.star.physics.temperatureUncertaintyK ? ` · temperatura: ±${stellarBody.star.physics.temperatureUncertaintyK} K` : ''}</div>}
        {stellarBody?.star.ds && <div>Distancia: {stellarBody.star.ds}{stellarBody.star.dataOrigin === 'exoplanet-host' ? ' · estrella añadida por albergar planetas (no figura en AT-HYG)' : ' (sustituye a la de AT-HYG)'}</div>}
        {stellarBody?.star.planetary?.map(system => <div key={system.id}>Planetas de {system.name} al {EXOPLANET_EPOCH} · {system.planets.slice(0, 8).map(planet => describePlanet(planet, system)).join(' · ')}{system.planets.length > 8 ? ' · …' : ''}
          <br />Supuestos · giro del plano en el cielo (Ω) convencional en todos{describeAssumptions(system).map(text => ` · ${text}`).join('')}{system.circumbinary ? ' · planetas circumbinarios: centrados en el punto del catálogo' : system.stars > 1 ? ' · anfitriona en un sistema múltiple: órbitas centradas en su punto del catálogo' : ''}
          <br />Datos: <a href="https://exoplanetarchive.ipac.caltech.edu/" target="_blank" rel="noreferrer">NASA Exoplanet Archive</a> (parámetros compuestos) · órbitas y radios a escala · color ilustrativo</div>)}
        {stellarBody?.star.system && <div>Sistema múltiple · WDS {stellarBody.star.system.wds} · {stellarBody.star.system.components.slice(0, 4).map(describeComponent).join(' · ')}{stellarBody.star.system.components.length > 4 ? ' · …' : ''}</div>}
        {stellarBody?.star.system?.hidden.length > 0 && <div>Sin dibujar, por no tener orientación medida: {stellarBody.star.system.hidden.slice(0, 4).map(item => `${item.n}${item.p ? ` (${period(item.p)})` : ''}`).join(', ')}{stellarBody.star.system.hidden.length > 4 ? '…' : ''}</div>}
        {stellarBody?.star.system && <div>Datos: <a href="https://www.astro.gsu.edu/wds/orb6.html" target="_blank" rel="noreferrer">ORB6</a> y <a href="https://www.astro.gsu.edu/wds/" target="_blank" rel="noreferrer">WDS</a> (USNO), <a href="https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJS/235/6" target="_blank" rel="noreferrer">MSC</a> (Tokovinin) · órbitas al {BINARY_MODEL_DATE} · masas estimadas · las compañeras son marcadores, no radios</div>}
        {curatedStellarBody && <div>Registro curado independiente de AT-HYG · distancia adoptada: {(stellarBody.star.d / LIGHT_YEAR_PC).toLocaleString('es-CL', { maximumFractionDigits: 0 })} años luz</div>}
        {stellarBody?.identifiers && <div className="star-identifiers">{stellarBody.identifiers}</div>}
        {(stellarBody?.star.physics || panelBody.name === 'Sol') && <div>Textura adaptada: <a href={PLANET_TEXTURE_SOURCE} target="_blank" rel="noreferrer">Solar System Scope</a> · <a href={PLANET_TEXTURE_LICENSE} target="_blank" rel="noreferrer">CC BY 4.0</a></div>}
        {panelBody.kind === 'system' ? <>
          <div>WC7 + O5.5 · modelo orbital estático</div>
          <div>Fecha del modelo: {BINARY_EPOCH}</div>
          <div>Separación entre estrellas: <strong>{BINARY_STATE.separationAu.toLocaleString('es-CL', { maximumFractionDigits: 2 })} UA</strong></div>
          <div>Rango orbital: {(WR140_ORBIT.semiMajorAu * (1 - WR140_ORBIT.eccentricity)).toFixed(2)}–{(WR140_ORBIT.semiMajorAu * (1 + WR140_ORBIT.eccentricity)).toFixed(2)} UA</div>
          <div>Distancia al Sol (catálogo): {(panelBody.distancePc / LIGHT_YEAR_PC).toLocaleString('es-CL', { maximumFractionDigits: 0 })} años luz</div>
        </> : <div>{panelBody.radiusKm ? `Radio ${stellarBody ? stellarBody.star.physics?.status === 'published' ? 'publicado' : 'estimado' : exoplanetBody ? exoplanetBody.planet.s.includes('r') ? 'estimado por masa' : 'medido' : 'medio'}: ${panelBody.radiusKm.toLocaleString('es-CL', { maximumFractionDigits: stellarBody ? 0 : 4 })} km` : 'Radio no disponible · marcador de posición'}</div>}
        {exoplanetBody && <div>Planeta de {exoplanetBody.system.name} · {describePlanet(exoplanetBody.planet, exoplanetBody.system)} · excentricidad {exoplanetBody.planet.e.toLocaleString('es-CL')} · inclinación {exoplanetBody.planet.inc.toLocaleString('es-CL')}° respecto del cielo · a {exoplanetBody.planet.separationAu.toLocaleString('es-CL', { maximumSignificantDigits: 3 })} UA de su estrella el {EXOPLANET_EPOCH}
          <br />Supuestos · giro del plano en el cielo (Ω) convencional{exoplanetBody.planet.assumptions.map(text => ` · ${text}`).join('')}</div>}
        <div data-body-altitude />
        {panelBody.inclinationDeg !== undefined && <div>Inclinación orbital: {panelBody.inclinationDeg.toLocaleString('es-CL', { maximumFractionDigits: 3 })}° respecto de la eclíptica (J2000)</div>}
        <p>{panelBody.kind === 'system' ? 'Separación y órbitas a escala. Puntos de identificación; diámetros y brillo ilustrativos.'
          : stellarBody ? stellarBody.star.physics ? `Esfera a escala del radio ${stellarBody.star.physics.status === 'published' ? 'publicado' : 'estimado'} · superficie compartida, no fotografía de esta estrella`
            : curatedStellarBody ? 'Posición curada de SIMBAD · distancia aproximada de NASA · tamaño del marcador ilustrativo'
              : 'Posición de catálogo · tamaño del marcador ilustrativo'
          : panelBody.name === 'Sol' ? 'Radio solar a escala · 5.772 K · textura y orientación ilustrativas'
          : bodyTexture ? `Esfera a escala real · ${bodyTexture.description.toLowerCase()} · orientación ilustrativa`
            : exoplanetBody ? 'Esfera a escala del radio · color neutro ilustrativo: no hay aspecto medido · iluminada desde su estrella'
            : 'Esfera a escala real · color ilustrativo'}</p>
        {panelBody.kind === 'system' ? <a href="https://doi.org/10.1093/mnras/stab1181" target="_blank" rel="noreferrer">Órbita: Thomas et al. (2021)</a>
          : curatedStellarBody ? <div><a href={panelBody.source} target="_blank" rel="noreferrer">Astrometría e identificadores: SIMBAD</a>
            {' · '}<a href={panelBody.distanceSource} target="_blank" rel="noreferrer">Distancia: NASA</a></div>
            : panelBody.source && <a href={panelBody.source} target="_blank" rel="noreferrer">{stellarBody ? stellarBody.star.physics?.sourceLabel || 'Método: Flower / Torres · datos AT-HYG' : exoplanetBody ? 'Fuente: NASA Exoplanet Archive (parámetros compuestos)' : `Fuente: NASA${panelBody.name !== 'Sol' ? ' / JPL' : ''}`}</a>}
        {bodyTexture && <div className="texture-credit">Textura: <a href={PLANET_TEXTURE_SOURCE} target="_blank" rel="noreferrer">Solar System Scope / INOVE</a>
          {' · '}<a href={PLANET_TEXTURE_LICENSE} target="_blank" rel="noreferrer">CC BY 4.0</a></div>}
      </aside>}
      <div data-labels className="scene-labels">
        {labels.map((label, i) => <span key={i} className={`scene-label ${label.kind}${aimTarget === label ? ' is-target' : ''}`} style={{ color: label.color }}>
          {label.kind === 'star' ? <button className="label-text" onDoubleClick={() => aimAtStar(label)}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); aimAtStar(label); }
            }} title="Doble clic: fijar rumbo">{label.text}</button>
            : label.body ? <button className="label-text" onClick={() => focusBody(label.body)} title={`Acercarse a ${label.body.name}`}>{label.text}</button>
            : <span className="label-text">{label.text}</span>}
        </span>)}
      </div>
      {binaryBody && <div className="binary-guides" data-binary-guides>
        <span data-component="wr" className="binary-label">Wolf-Rayet · WC7</span>
        <span data-component="o" className="binary-label">Compañera · O5.5</span>
        <svg className="binary-ruler" aria-label="Separación entre las dos estrellas">
          <path data-binary-path fill="none" stroke="currentColor" strokeWidth="0.7" />
          <text data-binary-distance textAnchor="middle">{BINARY_STATE.separationAu.toLocaleString('es-CL', { maximumFractionDigits: 2 })} UA</text>
        </svg>
      </div>}
      <svg data-ruler className="light-year-ruler" aria-label="Escala de un año luz">
        <path data-ruler-path fill="none" stroke="currentColor" strokeWidth="0.7" />
        <text data-ruler-text textAnchor="middle">Un año luz</text>
      </svg>
      <svg data-day-ruler className="light-year-ruler" aria-label="Escala de un día luz">
        <path data-ruler-path fill="none" stroke="currentColor" strokeWidth="0.7" />
        <text data-ruler-text textAnchor="middle">Un día luz</text>
      </svg>
      <div className="oort-note" data-oort-note>2.000–100.000 UA <span>/</span> Nube de Oort</div>
      <footer className="scene-footer">
        <span className={`navigation-hint${freeFlight ? ' flight-hint' : ''}`}>
          {freeFlight ? aimTarget ? 'W / S: acercarse / alejarse · Rueda: velocidad · A / D: lateral · Esc o girar: soltar objetivo'
            : 'Arrastra / flechas: mirar · WASD: mover · R/F: subir/bajar · Q/E: inclinar · Rueda: velocidad · Shift + rueda: ajuste rápido'
            : 'Arrastra para orbitar · Desplázate para acercarte'}
        </span>
        <span>© 2026 Sergio Bastidas</span>
      </footer>
    </div>
  </main>;
}
