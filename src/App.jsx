import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useProgress } from '@react-three/drei';
import { progresoCarga } from './progresoCarga';
import * as THREE from 'three';
import datosOficiales from '../data/processed/stellar_official.json';
import starsUrl from '../data/processed/stars_15pc.json?url';
import systemsUrl from '../data/processed/star_systems.json?url';
import { PUBLISHED_STELLAR_PHYSICS } from './scene/publishedStellarPhysics.js';
import StarField from './scene/StarField';
import SolarSystem from './scene/SolarSystem';
import OortCloud from './scene/OortCloud';
import Heliosphere from './scene/Heliosphere';
import { HELIOSPHERE_LABELS, HELIOSPHERE_VIEW } from './scene/heliosphereShape';
import FichaHeliosfera from './FichaHeliosfera';
import VisualGuides from './scene/VisualGuides';
import FreeFlight from './scene/FreeFlight';
import StarAim from './scene/StarAim.jsx';
import { AU_TO_PC, BODY_CAMERA_NEAR_PC, ECLIPTIC_UP, LIGHT_YEAR_PC, MAX_VIEW_DISTANCE_PC, OORT_OUTER_PC, PLANETS, SCENE_FAR_PC, SUN_RADIUS_PC, VIEWS, orbitalPosition } from './scene/scale';
import { SOLAR_BODIES, MOON, bodyView } from './scene/solarBodies';
import { EPHEMERIS_DATE } from './scene/solarEphemeris';
import { PLANET_TEXTURES, PLANET_TEXTURE_SOURCE, PLANET_TEXTURE_LICENSE } from './scene/planetTextures';
import { identifyStellarTargets, stellarTargets, WR140_ID } from './scene/stellarTargets';
import BinarySystem from './scene/BinarySystem';
import { BINARY_EPOCH, BINARY_STATE, WR140_ORBIT } from './scene/binaryOrbit';
import './App.css';
import './movil.css';
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
import { vistaAlDetener, PULSAR_VIEW } from './scene/navigation';
import { CURATED_STARS } from './scene/curatedStars';
import CompanionStars from './scene/CompanionStars';
import { buildStarSystems } from './scene/visualBinary.js';
import { JOURNEY_TIME_SCALE } from './scene/starJourney.js';
import PlanetarySystems from './scene/PlanetarySystem';
import MoonLabels from './MoonLabels';
import { FichaAnillos, FichaLuna } from './FichaLuna';
import { moonHost, useMoons } from './scene/moonBodies';
import { probeHighlight, useProbes } from './scene/probeTrajectories';
import ExoplanetDiscoveries from './scene/ExoplanetDiscoveries';
import ZoomSuave from './scene/ZoomSuave';
import PanelDescubrimientos from './PanelDescubrimientos';
import { useDescubrimientos } from './scene/useDescubrimientos.js';
import { DEFAULT_FILTER as FILTRO_DESCUBRIMIENTOS } from './scene/descubrimientos.js';
import { DEFAULT_DISCOVERY_VIEW } from './scene/discoveryViews.js';
import { cambiarFiltroEstelar, filtroPorId, useFiltroEstelar } from './scene/filtroEstelar';
import CreditoSDO from './CreditoSDO';
import PantallaCompleta from './PantallaCompleta';
import AvisoCelular from './AvisoCelular';
import MenuVer from './MenuVer';
import ControlesComputador from './ControlesComputador';
import { colorLegible, fisicaOficial } from './scene/stellarPhysics';
import FichaEstrella from './FichaEstrella';
import FiltrosSol from './FiltrosSol';
import FichaLateral from './FichaLateral';
import { useFichas } from './useFichas';
import { useEsComputador } from './esComputador';
import { CONTORNO_SOLAR_HASTA, DURACION_CAMBIO_S, UA_POR_RADIO_SOLAR, alcance, definirCandidatas, elegirComparacion, estadoComparacion, mostrarComparacion, suscribirComparacion } from './scene/comparacionSol';
import FranjaHabitable from './scene/FranjaHabitable';
import { encuadreDeSistema, zonaDeEstrella } from './scene/zonaHabitable';
import { cambiarOrbitas, cambiarZonaVisible, useOrbitas, useZonaVisible } from './scene/guiasOrbitales';
import SelectorBrillo from './SelectorBrillo';
import FichaPlaneta from './FichaPlaneta';
import { ARRIVAL_FRAME_FACTOR, buildPlanetarySystems, hostPhysics } from './scene/exoplanetOrbit.js';

// El catálogo pesa más que el resto de la aplicación: se descarga aparte para que
// el sistema solar y la interfaz aparezcan antes. Hasta entonces solo hay curados.
function buildCatalogue({ catalogue, systems, planets }) {
  // Radio y temperatura de las anfitrionas de exoplanetas publicados en el archivo de la
  // NASA: preceden a la estimación fotométrica.
  const hostPhysicsById = new Map((planets?.systems || []).map(system => [system.i, hostPhysics(system.st)]));
  const stars = identifyStellarTargets([...catalogue, ...CURATED_STARS])
    .map(star => ({ ...star, datos: datosOficiales[star.i] || null, physics: PUBLISHED_STELLAR_PHYSICS[star.i] || hostPhysicsById.get(star.i) || fisicaOficial(datosOficiales[star.i]) }));
  const STELLAR_TARGETS = stellarTargets(stars);
  const starsById = new Map(stars.map(star => [star.i, star]));
  // Coloca las componentes de los sistemas múltiples; puede situar sobre su órbita a
  // una compañera que ya era un registro del catálogo.
  const BINARY_SYSTEMS = buildStarSystems(systems, starsById);
  for (const system of BINARY_SYSTEMS) {
    system.star.system = system;
    // Una compañera con registro propio también conoce su sistema, para la ficha.
    for (const component of system.components) if (component.companion) component.companion.sistemaDe = system;
  }
  // Sistemas planetarios, después de recolocar compañeras: usan la posición final de su estrella.
  const PLANETARY_SYSTEMS = buildPlanetarySystems(planets, starsById);
  for (const system of PLANETARY_SYSTEMS) (system.star.planetary ||= []).push(system);
  // Las dos estrellas de una binaria anfitriona comparten los planetas del par.
  for (const system of PLANETARY_SYSTEMS) for (const component of system.binary?.components || []) component.star.planetary = system.star.planetary;
  return { stars, starsById, STELLAR_TARGETS, BINARY_SYSTEMS, PLANETARY_SYSTEMS,
    NAVIGATION_TARGETS: [...SOLAR_BODIES, ...STELLAR_TARGETS],
    BINARY_BACKGROUND: stars.filter(star => star.i !== WR140_ID) };
}
const EMPTY_CATALOGUE = { catalogue: [], systems: {}, planets: null };
// Resumen de una componente para la ficha.
const SCALE_VIEWS = [VIEWS[0], KUIPER_VIEW, HELIOSPHERE_VIEW, ...VIEWS.slice(1)];
const SOLAR_ORIGIN = [0, 0, 0];
// Pantalla táctil como entrada principal (celular o tableta): cambia la ayuda del vuelo libre.
const TACTIL = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
const EARTH = SOLAR_BODIES.find(body => body.name === 'Tierra');
// Artículo del nombre en el título del visor: «al Sol», «a la Tierra», «a Marte», «a Sirius».
const distanceTitle = name => `Distancia ${name === 'Sol' || name === 'centro galáctico' ? 'al' : name === 'Tierra' || name === 'Luna' ? 'a la' : 'a'} ${name}`;
// Vista al cargar: la cámara a 7° sobre la eclíptica, mirando la Tierra con el Sol 25° a la
// izquierda; se calcula desde la dirección del Sol en la fecha, así se ve igual cualquier día.
// Cuánto más lejos queda la cámara al comparar con una estrella mayor que el Sol (1 = encuadre justo).
const ALEJAMIENTO_COMPARACION = 1.7;
// Si el radio nuevo difiere menos que este factor del radio de la estrella encuadrada, la cámara no se mueve.
const RANGO_SIN_MOVER = 1.5;
const START_DIRECTION = (() => {
  const up = new THREE.Vector3(...ECLIPTIC_UP), sunward = new THREE.Vector3(...EARTH.position).negate().normalize();
  const sunHorizontal = sunward.addScaledVector(up, -sunward.dot(up)).normalize();
  const view = sunHorizontal.applyAxisAngle(up, -25 * Math.PI / 180).multiplyScalar(Math.cos(7 * Math.PI / 180)).addScaledVector(up, -Math.sin(7 * Math.PI / 180));
  return view.negate().normalize();
})();
const INITIAL_VIEW = bodyView(EARTH);
const START_POSITION = START_DIRECTION.clone().multiplyScalar(INITIAL_VIEW.distance).add(new THREE.Vector3(...EARTH.position)).toArray();

// Avisa a la pantalla de carga (index.html) cuando todo está listo: catálogo de estrellas
// recibido, sin texturas pendientes (Tierra, planetas, Luna) y dos cuadros ya dibujados con ellos.
function SceneReady({ catalogueReady }) {
  const frames = useRef(0);
  const { active, loaded, total } = useProgress();
  const texturesReady = !active && loaded >= total;
  useEffect(() => { progresoCarga('texturas', texturesReady ? 1 : total ? loaded / total : 0); }, [texturesReady, loaded, total]);
  useFrame(() => {
    if (!catalogueReady || !texturesReady) { frames.current = 0; return; }
    if (++frames.current === 2) window.hoshiCargaLista?.();
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
    // El catálogo se pide como archivo estático: importarlo como módulo hace que vite lo transforme
    // con source map y el servidor de desarrollo llega a ~4 GB de RAM.
    const json = url => fetch(url).then(response => { if (!response.ok) throw new Error(url); return response.json(); });
    const partes = [json(starsUrl), json(systemsUrl), planets];
    let recibidas = 0;
    partes.forEach(parte => parte.then(() => progresoCarga('catalogo', ++recibidas / partes.length), () => {}));
    Promise.all(partes)
      .then(([stars, systems, planets]) => { if (active) { setCatalogue({ catalogue: stars, systems, planets }); setCatalogueStatus('ready'); } })
      .catch(() => { if (active) setCatalogueStatus('error'); });
    return () => { active = false; };
  }, []);
  const { stars, starsById, STELLAR_TARGETS, NAVIGATION_TARGETS, BINARY_BACKGROUND, BINARY_SYSTEMS, PLANETARY_SYSTEMS } = useMemo(() => buildCatalogue(catalogue), [catalogue]);
  const [view, setView] = useState(INITIAL_VIEW);
  const [freeFlight, setFreeFlight] = useState(false);
  const filtroEstelar = useFiltroEstelar();
  const [traveling, setTraveling] = useState(false);
  const [showHeliosphere, setShowHeliosphere] = useState(true);
  const [speed, setSpeed] = useState(0);
  const [velocidadSolicitada, setVelocidadSolicitada] = useState(null);
  const [showBodyPanel, setShowBodyPanel] = useState(false);
  const [showPulsars, setShowPulsars] = useState(false);
  // Modo de descubrimientos de exoplanetas: estrellas y galaxia atenuadas, sistemas resaltados.
  const [showDiscoveries, setShowDiscoveries] = useState(false);
  const [discoveryFilter, setDiscoveryFilter] = useState(FILTRO_DESCUBRIMIENTOS);
  const discoveries = useDescubrimientos(showDiscoveries);
  const [galaxyStatus, setGalaxyStatus] = useState('idle');
  const [aimTarget, setAimTarget] = useState(null);
  const [inspectedTarget, setInspectedTarget] = useState(null);
  const [departureBody, setDepartureBody] = useState(null);
  const cameraRef = useRef();
  const releaseAim = useCallback(() => setAimTarget(null), []);
  // El botón «Sol» queda encendido mientras la cámara sigue apuntando al Sol tras pulsarlo.
  const [solApuntado, setSolApuntado] = useState(false);
  // Un clic en el nombre abre su ficha sin mover la cámara; el doble clic viaja a ella.
  const [estrellaVista, setEstrellaVista] = useState(null);
  const esComputador = useEsComputador();
  const verOrbitas = useOrbitas(), verZona = useZonaVisible();
  const fichas = useFichas();
  const [direccionFicha, setDireccionFicha] = useState(1);
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
  // Estrellas de una binaria anfitriona a las que se puede viajar por separado.
  // Lunas del planeta enfocado o de la luna enfocada (Júpiter y Saturno), para el selector.
  const { bodies: moonBodies } = useMoons();
  const { probes: probeBodies } = useProbes();
  const localMoons = moonBodies.filter(body => body.planet === moonHost(view.body));
  const localStars = (hostStar?.planetary || []).flatMap(system => (system.binary?.components || []).filter(component => component.body).map(component => component.body));
  const hostName = exoplanetBody && (hostStar.n || exoplanetBody.system.name);
  const origin = binaryBody?.position || stellarBody?.position || exoplanetBody?.position || SOLAR_ORIGIN;
  const navigate = (destination, options = {}) => {
    const camera = cameraRef.current;
    if (!camera) return;
    const start = camera.position.toArray().map((v, i) => v + origin[i]);
    const rotation = camera.quaternion.toArray();
    transitionRef.current = null;
    releaseAim();
    setSolApuntado(false);
    setEstrellaVista(null);
    setFreeFlight(false);
    setTraveling(true);
    setVelocidadSolicitada(null);
    setDepartureBody(view.body || departureBody);
    // Toda vista sin vertical propia devuelve la cámara a la normal eclíptica.
    setView({ ...destination, target: destination.target || SOLAR_ORIGIN, up: destination.up || ECLIPTIC_UP,
      journey: { start, rotation, ...options } });
    document.activeElement?.blur();
  };
  // Toda estrella elegida queda fija, a la distancia de su superficie y con su ficha abierta;
  // `sistema` conserva el encuadre del sistema al llegar desde Exoplanetas.
  const visitBody = (elegido, fromSearch = false, sistema = false) => {
    let body = elegido;
    if (elegido.kind === 'star' && elegido.star) {
      const physics = elegido.star.physics;
      if (physics && !sistema) body = { kind: 'star', name: elegido.name, position: elegido.position, star: elegido.star, radiusKm: physics.radiusKm,
        source: physics.source, distanceSource: elegido.distanceSource, identifiers: elegido.identifiers };
      else if (physics) body = { ...elegido, radiusKm: physics.radiusKm };
    }
    setShowPulsars(false); setShowDiscoveries(false);
    setShowBodyPanel(fromSearch || Boolean(body.star && body.kind === 'star'));
    setInspectedTarget(fromSearch && body.kind === 'star'
      ? {kind:'star',text:body.name,star:body.star,catalogueId:body.star.i,position:body.position} : null);
    navigate({ ...bodyView(body), ...(!sistema && body.kind === 'star' && encuadreDeSistema(body.star, fichas)) });
  };
  const focusBody = body => { visitBody(body); if (body.kind === 'exoplanet' || body.kind === 'satellite' || body.name === 'Saturno') setShowBodyPanel(true); };
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
    setShowDiscoveries(false); setShowPulsars(true); setShowBodyPanel(false); setInspectedTarget(null);
    navigate(PULSAR_VIEW, { duration: 4 * JOURNEY_TIME_SCALE });
  };
  const frameGalaxy = (edgeOn = false) => {
    setShowDiscoveries(false); setShowPulsars(false); setShowBodyPanel(false); setInspectedTarget(null);
    navigate(galaxyView(edgeOn), { duration: 8 * JOURNEY_TIME_SCALE });
  };
  const viajarDesdeBarra = (valor, siguiendo = false) => {
    if (!cameraRef.current) return;
    setShowPulsars(false); setShowBodyPanel(false); setInspectedTarget(null);
    navigate(destinoDesdeBarra(valor, cameraRef.current.position.toArray(), origin), {arriveFree:freeFlight, duration:siguiendo ? 0.45 : 2});
  };
  // Dedo arrastrado sobre la escala: la primera vez se viaja a la vista de escala; ya en ella,
  // la cámara se coloca a la distancia que marca el dedo en cada movimiento, como con la rueda.
  const seguirBarra = (valor, final = false) => {
    const camera = cameraRef.current;
    if (!camera) return;
    if (traveling && !final) return;
    setSolApuntado(false);
    if (view.id !== 'escala' || view.centro || traveling || freeFlight || valor >= 99.9) { viajarDesdeBarra(valor, true); return; }
    const destino = destinoDesdeBarra(valor, camera.position.toArray(), origin);
    camera.position.set(...destino.target.map((v, i) => v - origin[i] + destino.direction[i] * destino.distance));
  };
  // Detener un viaje en curso (T-03, pedido de Sergio): clic en la escena o Esc. Sin destino concreto,
  // la cámara queda donde está y pasa a vuelo libre, que conserva posición y orientación.
  const detenerViaje = () => {
    if (!traveling) return;
    // Con un destino concreto, la cámara se queda donde está y gira hacia él para orbitarlo.
    // Si ya está girando para fijarse, otro clic no cambia nada.
    if (view.journey?.headingOnly && (view.body || view.id === 'solar-aim')) return;
    const fijar = vistaAlDetener(view, cameraRef.current?.position.toArray(), origin);
    if (fijar) { navigate(fijar, { headingOnly: true }); return; }
    transitionRef.current = null;
    setSolApuntado(false);
    setTraveling(false);
    setFreeFlight(true);
  };
  useEffect(() => {
    if (!traveling) return;
    const tecla = event => { if (event.key === 'Escape') detenerViaje(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  });
  const toggleFlight = () => {
    if (freeFlight) { aimAtSun(); return; }
    transitionRef.current = null;
    setSolApuntado(false);
    setTraveling(false);
    releaseAim();
    setFreeFlight(true);
  };
  const aimAtStar = label => visitBody(starBody(label.star, label.text), true);
  const aimAtSun = () => {
    const camera = cameraRef.current;
    if (!camera) return;
    setShowPulsars(false);
    setShowBodyPanel(false);
    setInspectedTarget(null);
    navigate({id:'solar-aim',target:SOLAR_ORIGIN,
      distance:Math.hypot(...camera.position.toArray().map((v,i)=>v+origin[i]))}, { headingOnly:true });
    setSolApuntado(true);
  };
  const visitSearchResult = (result, sistema = false) => {
    const star=starsById.get(result.id);
    if(!star || !cameraRef.current)return;
    setShowPulsars(false);
    const body=STELLAR_TARGETS.find(b=>b.catalogueId===star.i) || (star.n==='Sol'?SOLAR_BODIES[0]
      : starBody(star, star.n||result.aliases[0], result.aliases.slice(0, 10).join(' · ') + (result.aliases.length > 10 ? ' · …' : '')));
    if (star.n === 'Sol' || star.n === 'Sun') { aimAtSun(); return; }
    visitBody(body, true, sistema);
  };
  const frameDiscoveries = discoveryView => {
    setShowPulsars(false); setShowBodyPanel(false); setInspectedTarget(null); setShowDiscoveries(true);
    navigate(discoveryView, { duration: 11 });
  };
  // Clic en un destello: viajar a la estrella si está en el catálogo de Hoshi.
  const visitDiscovery = index => {
    const id = discoveries.data.systems.i[index];
    // Desde Exoplanetas se llega encuadrando el sistema completo.
    if (id >= 0) visitSearchResult({ id, aliases: [discoveries.data.systems.n[index]] }, true);
  };
  const labels = useMemo(() => [
    { kind: 'moon', text: `Luna · ${(Math.round(MOON.distanceKm / 100) * 100).toLocaleString('es-CL')} km de la Tierra`, position: MOON.position, width:230, body:MOON },
    { kind: 'sun', text: 'Sol', position: [0, 0, 0], width: 34, body: SOLAR_BODIES[0] },
    ...PLANETS.map(p => ({ kind: 'planet', au: p.au, text: p.name,
      position: SOLAR_BODIES.find(b => b.name === p.name).position, width: 145, color: p.color, body: SOLAR_BODIES.find(b => b.name === p.name) })),
    ...probeBodies.map(p => ({ kind: 'probe', code: p.code, text: p.name, position: p.position, width: 120, color: p.color })),
    { kind: 'oort', text: 'Nube de Oort', position: [-OORT_OUTER_PC * 0.8, 0, 0], width: 125 },
    { kind: 'kuiper', text: 'Cinturón de Kuiper · 30–50 UA', position: orbitalPosition({au:45,inclinationDeg:0,ascendingNodeDeg:0},2.6), width: 225 },
    ...(showHeliosphere ? HELIOSPHERE_LABELS : []),
    ...stars.filter(s => s.n && s.n !== 'Sol' && s.n !== 'Sun').sort((a,b) => a.d - b.d)
      .map(s => ({ kind: 'star', star: s, catalogueId: s.i, text: s.n, position: [s.x, s.y, s.z], width: s.n.length * 6 + 10,
        body: STELLAR_TARGETS.find(target => target.catalogueId === s.i) })),
  ], [stars, STELLAR_TARGETS, probeBodies, showHeliosphere]);
  // Objetivo del visor de distancia: el rumbo fijado; en vuelo libre, la estrella
  // inspeccionada o el Sol; en las demás vistas, lo que queda centrado.
  const distanceTarget = aimTarget?.kind === 'star' ? { name: aimTarget.text, position: aimTarget.position }
    : freeFlight ? inspectedTarget ? { name: inspectedTarget.text, position: inspectedTarget.position } : null
    : view.body ? { name: view.body.name, position: view.body.position }
    : view.id === 'galaxy' || view.centro === 'galaxia' ? { name: 'centro galáctico', position: GALAXY_CENTER }
    : view.id === 'escala' ? { name: 'Tierra', position: EARTH.position } : null;
  // Botones de escalas y modos: en el computador quedan a la vista vuelo libre, Sol y filtro, y el
  // resto va en la lista «Ir a»; en el celular todo va en la lista.
  // El Sol es el foco al llegar a él o tras apuntarle con el botón «Sol».
  const solEnFoco = view.body?.name === 'Sol' || (view.id === 'solar-aim' && !freeFlight);
  // Comparar tamaños: otra estrella en el lugar del Sol. Al llegar, la cámara encuadra la estrella y
  // la primera órbita que queda fuera; al volver, reencuadra el Sol. Salir del Sol la deshace.
  // App no se vuelve a dibujar con cada cambio de la comparación (es costoso): la sigue con una suscripción.
  const vigente = useRef({});
  useEffect(() => { vigente.current = { solEnFoco, navigate }; });
  useEffect(() => definirCandidatas(stars), [stars]);
  // Si la nueva es más grande, la cámara se aleja primero y la estrella cambia al llegar; si es más
  // chica, cambia primero y la cámara se acerca después. Así nunca se queda dentro de la nueva.
  const estrellaPendiente = useRef(undefined);
  const encuadreComparacion = useRef(null);
  useEffect(() => {
    if (traveling || estrellaPendiente.current === undefined) return;
    mostrarComparacion(estrellaPendiente.current);
    estrellaPendiente.current = undefined;
  }, [traveling]);
  useEffect(() => {
    let previa = estadoComparacion().elegida;
    return suscribirComparacion(() => {
      const { elegida, mostrada } = estadoComparacion();
      if (previa === elegida) return;
      previa = elegida;
      const { solEnFoco: enSol, navigate: ir } = vigente.current;
      const sol = SOLAR_BODIES[0];
      estrellaPendiente.current = undefined;
      if (!elegida) {
        encuadreComparacion.current = null;
        mostrarComparacion(null);
        if (enSol) setTimeout(() => vigente.current.navigate(bodyView(sol), { duration: 2.5, comparacion: true }), DURACION_CAMBIO_S * 1000);
        return;
      }
      const { ua, primeraFuera } = alcance(elegida.radiusSolar);
      // Hasta unos 10 R☉ se encuadra el contorno del Sol; las más grandes, con la primera órbita que queda fuera.
      const encuadre = elegida.radiusSolar <= CONTORNO_SOLAR_HASTA ? Math.max(elegida.radiusSolar, 1) * UA_POR_RADIO_SOLAR * 1.6 : Math.max(ua * 1.3, primeraFuera?.au ?? 0);
      const distancia = encuadre * 2.4 * (elegida.radiusSolar > 1 ? ALEJAMIENTO_COMPARACION : 1) * AU_TO_PC;
      // Entre estrellas de tamaño parecido la cámara se queda quieta y solo cambia la estrella. Se compara con
      // la estrella del encuadre actual, no con la anterior, para que varios cambios chicos no se acumulen.
      const encuadrada = encuadreComparacion.current, radio = elegida.radiusSolar;
      if (enSol && encuadrada && Math.max(radio / encuadrada, encuadrada / radio) <= RANGO_SIN_MOVER) { mostrarComparacion(elegida); return; }
      encuadreComparacion.current = radio;
      const crece = elegida.radiusSolar > (mostrada?.radiusSolar ?? 1);
      if (!crece || !enSol) mostrarComparacion(elegida);
      else estrellaPendiente.current = elegida;
      // Desde 35° sobre la eclíptica, para que se vean las órbitas que quedan dentro de la estrella.
      const arriba = new THREE.Vector3(...ECLIPTIC_UP).normalize();
      const lado = new THREE.Vector3(1, 0, 0).projectOnPlane(arriba).normalize();
      const direccion = lado.multiplyScalar(Math.cos(0.61)).addScaledVector(arriba, Math.sin(0.61)).toArray();
      const destino = { ...bodyView(sol), distance: distancia, direction: direccion, up: ECLIPTIC_UP }, opciones = { duration: 2.5, comparacion: true };
      // Si se achica, primero se encoge la estrella y después se acerca la cámara.
      if (crece || !enSol) ir(destino, opciones);
      else setTimeout(() => vigente.current.navigate(destino, opciones), DURACION_CAMBIO_S * 1000);
    });
  }, []);
  useEffect(() => { if (estadoComparacion().elegida && (!solEnFoco || freeFlight)) elegirComparacion(null); }, [solEnFoco, freeFlight]);
  const acciones = [
    ...SCALE_VIEWS.map(option => ({ id: option.id, texto: option.label })),
    { id: 'via-lactea', texto: 'Vía Láctea', activa: view.id === 'galaxy' },
    { id: 'pulsares', texto: 'Mapa de púlsares', activa: showPulsars },
    { id: 'exoplanetas', texto: 'Exoplanetas', activa: showDiscoveries, fija: true },
    { id: 'vuelo-libre', texto: 'Vuelo libre', textoLista: freeFlight ? 'Salir del vuelo libre' : 'Vuelo libre', activa: freeFlight, fija: true },
    { id: 'volver-sol', texto: 'Volver al Sol', fija: true },
    { id: 'orbitas', texto: 'Órbitas', activa: verOrbitas, titulo: 'Muestra u oculta las órbitas' },
    { id: 'zona-habitable', texto: 'Zona habitable', activa: verZona, titulo: 'Muestra u oculta la zona habitable de la estrella elegida' },
    { id: 'heliosfera', texto: showHeliosphere ? 'Ocultar heliosfera' : 'Mostrar heliosfera', activa: !showHeliosphere,
      titulo: 'Muestra u oculta la heliosfera' },
    // El filtro solo afecta al Sol: aparece únicamente al estar en él.
    { id: 'filtro', texto: `Sol en: ${filtroPorId(filtroEstelar).nombre}`, valor: filtroPorId(filtroEstelar).nombre, activa: filtroEstelar !== 'ninguno', fija: true, oculta: !solEnFoco,
      titulo: 'Cambia el filtro con que se observa el Sol: sin filtro o las imágenes más recientes del SDO en luz visible, ultravioleta extremo y campo magnético' },
  ];
  const ejecutarAccion = id => {
    const escala = SCALE_VIEWS.find(option => option.id === id);
    if (escala) { setShowDiscoveries(false); setShowPulsars(false); setShowBodyPanel(false); setInspectedTarget(null); navigate(escala); }
    else if (id === 'via-lactea') frameGalaxy();
    else if (id === 'pulsares') {
      if (showPulsars) { setShowPulsars(false); transitionRef.current=null; setTraveling(false); setFreeFlight(true); }
      else framePulsars();
    }
    else if (id === 'exoplanetas') { if (showDiscoveries) setShowDiscoveries(false); else frameDiscoveries(DEFAULT_DISCOVERY_VIEW); }
    else if (id === 'vuelo-libre') toggleFlight();
    else if (id === 'volver-sol') aimAtSun();
    else if (id === 'ir-al-sol') focusBody(SOLAR_BODIES[0]);
    else if (id === 'orbitas') cambiarOrbitas(!verOrbitas);
    else if (id === 'zona-habitable') cambiarZonaVisible(!verZona);
    else if (id === 'heliosfera') setShowHeliosphere(visible => !visible);
    else if (id === 'filtro') cambiarFiltroEstelar();
  };
  const cerrarFicha = () => { setEstrellaVista(null); setShowBodyPanel(false); releaseAim(); };
  // Pasar de la estrella a uno de sus planetas y volver, como páginas de la misma ficha.
  const verPlanetaDesdeFicha = planeta => {
    setDireccionFicha(1);
    focusBody(planeta);
  };
  const verComponenteDesdeFicha = (star, nombre) => {
    setDireccionFicha(1);
    visitBody(starBody(star, nombre), true);
  };
  const verEstrellaDesdeFicha = () => {
    setDireccionFicha(-1);
    visitBody(starBody(hostStar, hostName));
    setShowBodyPanel(true);
  };
  const orbitTarget = (view.target || SOLAR_ORIGIN).map((v,i)=>v-origin[i]);
  // Datos del cuerpo enfocado, en su recuadro o dentro de la ficha de estrella.
  const detalle = showBodyPanel && panelBody && <>
        {panelBody.name === 'Sol' && <div>Superficie simulada con medidas solares de granulación, manchas y oscurecimiento del borde, escaladas a la temperatura y el radio; tiempo acelerado 60 veces</div>}
        {panelBody.kind === 'system' ? <>
          <div>WC7 + O5.5 · modelo orbital estático</div>
          <div>Fecha del modelo: {BINARY_EPOCH}</div>
          <div>Separación entre estrellas: <strong>{BINARY_STATE.separationAu.toLocaleString('es-CL', { maximumFractionDigits: 2 })} UA</strong></div>
          <div>Rango orbital: {(WR140_ORBIT.semiMajorAu * (1 - WR140_ORBIT.eccentricity)).toFixed(2)}–{(WR140_ORBIT.semiMajorAu * (1 + WR140_ORBIT.eccentricity)).toFixed(2)} UA</div>
          <div>Distancia al Sol (catálogo): {(panelBody.distancePc / LIGHT_YEAR_PC).toLocaleString('es-CL', { maximumFractionDigits: 0 })} años luz</div>
        </> : <div>{panelBody.radiusKm ? `Radio ${stellarBody ? stellarBody.star.physics?.status === 'published' ? 'publicado' : 'estimado' : exoplanetBody ? exoplanetBody.planet.s.includes('r') ? 'estimado por masa' : 'medido' : panelBody.radiusLabel || 'medio'}: ${panelBody.radiusKm.toLocaleString('es-CL', { maximumFractionDigits: stellarBody ? 0 : 4 })} km` : 'Radio no disponible · marcador de posición'}</div>}
        {panelBody.kind === 'satellite' && <FichaLuna body={panelBody} />}
        {panelBody.name === 'Saturno' && <FichaAnillos />}
                {panelBody.inclinationDeg !== undefined && <div>Inclinación orbital: {panelBody.inclinationDeg.toLocaleString('es-CL', { maximumFractionDigits: 3 })}° respecto de la eclíptica (J2000){panelBody.eccentricity !== undefined && ` · excentricidad ${panelBody.eccentricity.toLocaleString('es-CL', { maximumFractionDigits: 4 })} · posición del ${EPHEMERIS_DATE.toLocaleDateString('es-CL')} (elementos de JPL)`}</div>}
        <p>{panelBody.kind === 'system' ? 'Separación y órbitas a escala. Puntos de identificación; diámetros y brillo ilustrativos.'
          : panelBody.name === 'Sol' ? 'Radio solar a escala · 5.772 K · textura y orientación ilustrativas'
          : bodyTexture ? `Esfera a escala real · ${bodyTexture.description.toLowerCase()} · orientación ilustrativa`
            : 'Esfera a escala real · color ilustrativo'}</p>
        {panelBody.kind === 'system' ? <a href="https://doi.org/10.1093/mnras/stab1181" target="_blank" rel="noreferrer">Órbita: Thomas et al. (2021)</a>
          : curatedStellarBody ? <div><a href={panelBody.source} target="_blank" rel="noreferrer">Astrometría e identificadores: SIMBAD</a>
            {' · '}<a href={panelBody.distanceSource} target="_blank" rel="noreferrer">Distancia: NASA</a></div>
            : panelBody.source && <a href={panelBody.source} target="_blank" rel="noreferrer">{stellarBody ? stellarBody.star.physics?.sourceLabel || 'Método: Flower / Torres · datos AT-HYG' : exoplanetBody ? 'Fuente: NASA Exoplanet Archive (parámetros compuestos)' : `Fuente: NASA${panelBody.name !== 'Sol' ? ' / JPL' : ''}`}</a>}
        {bodyTexture && <div className="texture-credit">Textura: <a href={PLANET_TEXTURE_SOURCE} target="_blank" rel="noreferrer">Solar System Scope / INOVE</a>
          {' · '}<a href={PLANET_TEXTURE_LICENSE} target="_blank" rel="noreferrer">CC BY 4.0</a></div>}
        </>;
  // La zona habitable se dibuja para la estrella de la ficha abierta; si no cabría en pantalla, la cámara se aleja.
  const estrellaZona = exoplanetBody && showBodyPanel ? exoplanetBody.star : estrellaVista?.star ?? (showBodyPanel ? stellarBody?.star : null);
  const mostrarZona = () => {
    cambiarZonaVisible(true);
    const zona = zonaDeEstrella(estrellaZona, fichas), camara = cameraRef.current;
    if (!zona || !camara) return;
    // Sin haber viajado a la estrella la franja sería invisible: primero se va hacia ella.
    if (estrellaVista) {
      const sistema = estrellaZona.planetary?.[0];
      setShowBodyPanel(true);
      navigate({ ...bodyView(starBody(estrellaZona, estrellaVista.text)), distance: zona.exterior * 2.6 * AU_TO_PC,
        ...(sistema && { direction: sistema.viewDirection, up: sistema.viewUp }) });
      return;
    }
    if (view.body !== stellarBody || !stellarBody) return;
    // Se mira el plano de las órbitas abierto: de canto, la franja sería solo una línea.
    const sistema = estrellaZona.planetary?.[0];
    const distanciaPc = Math.hypot(...camara.position.toArray().map((v, i) => v + origin[i] - view.target[i]));
    navigate({ ...view, distance: Math.max(zona.exterior * 2.6 * AU_TO_PC, Math.min(distanciaPc, zona.exterior * 8 * AU_TO_PC)),
      ...(sistema && { direction: sistema.viewDirection, up: sistema.viewUp }) }, { duration: 3 });
  };
  // Ficha lateral: la del planeta enfocado, la de la estrella enfocada o la de la estrella fijada.
  const fichaPlaneta = !estrellaVista && showBodyPanel && exoplanetBody;
  const estrellaEnfocada = !estrellaVista && showBodyPanel && !exoplanetBody && stellarBody;
  const estrellaFicha = estrellaVista ? estrellaVista.star : estrellaEnfocada?.star;
  const temperaturaFicha = estrellaFicha?.physics?.temperatureK ?? estrellaFicha?.datos?.temperatureK;
  const nombreFicha = fichaPlaneta ? exoplanetBody.name : estrellaVista ? estrellaVista.text : panelBody?.name;
  return <main className={`hoshi${showDiscoveries ? ' modo-descubrimientos' : ''}`}
    onPointerDown={event => { if (traveling && event.target instanceof HTMLCanvasElement) detenerViaje(); }}>
    <Canvas camera={{ position: START_POSITION, up: ECLIPTIC_UP, fov: 50, near: BODY_CAMERA_NEAR_PC, far: SCENE_FAR_PC }}
      dpr={[1, 1.5]} gl={{ antialias: true, logarithmicDepthBuffer: true }}>
      <SceneReady catalogueReady={catalogueStatus !== 'loading'} />
      <color attach="background" args={['#020305']} />
      {freeFlight ? <FreeFlight velocidadSolicitada={velocidadSolicitada} onSpeedChange={setSpeed} initialBody={view.body} origin={origin} onManualLook={releaseAim} aimTarget={aimTarget} inspectedTarget={inspectedTarget} /> : !traveling && <OrbitControls ref={controlsRef} target={orbitTarget}
        minDistance={view.minDistance ?? SUN_RADIUS_PC * 1.02} maxDistance={MAX_VIEW_DISTANCE_PC}
        enablePan={false} enableDamping dampingFactor={0.06} rotateSpeed={0.45} zoomSpeed={1.35}
        onStart={() => { transitionRef.current = null; setSolApuntado(false); }} />}
      {!freeFlight && !traveling && <ZoomSuave controlsRef={controlsRef} />}
      <CameraNavigation view={view} showPulsars={showPulsars} transitionRef={transitionRef} origin={origin} onComplete={arriveFree => { setTraveling(false); setFreeFlight(arriveFree); document.activeElement?.blur(); }} />
      <StarAim target={aimTarget} origin={origin} onRelease={releaseAim} cameraRef={cameraRef} />
      <MilkyWay origin={origin} onStatus={setGalaxyStatus} muted={showPulsars} dim={showDiscoveries ? 0.32 : 1} />
      {showPulsars && <PulsarMap origin={origin} />}
      <StarField gain={showPulsars ? 0.18 : showDiscoveries ? 0.08 : 1} stars={binaryBody || departureBody?.kind === 'system' ? BINARY_BACKGROUND : stars} origin={origin}
        focusedStar={inspectedTarget?.star || hostStar} departureStar={departureBody?.star} />
      {binaryBody && <BinarySystem />}
      {!binaryBody && <CompanionStars onElegir={(star, nombre) => visitBody(starBody(star, nombre), true)} systems={BINARY_SYSTEMS} origin={origin} />}
      {verZona && estrellaZona && <FranjaHabitable key={estrellaZona.i} star={estrellaZona} origin={origin} fichas={fichas} />}
      {!binaryBody && <PlanetarySystems systems={PLANETARY_SYSTEMS} origin={origin} onSelect={focusBody} />}
      {showDiscoveries && discoveries.data && <ExoplanetDiscoveries data={discoveries.data} filter={discoveryFilter} origin={origin} onSelect={visitDiscovery} />}
      {!binaryBody && departureBody?.kind === 'system' && <BinarySystem position={departureBody.position.map((v,i)=>v-origin[i])} />}
      {/* Conservar el escenario de partida al cambiar el origen local a una estrella. */}
      <group position={origin.map(v=>-v)}>
        <OortCloud origin={origin} /><SolarSystem origin={origin} /><KuiperBelt origin={origin} /><Heliosphere origin={origin} hidden={!showHeliosphere} />
      </group>
      <VisualGuides overlayRef={overlayRef} labels={labels} focusedBody={panelBody} origin={origin} binary={Boolean(binaryBody)} aimTarget={aimTarget} distanceTarget={distanceTarget?.position} />
    </Canvas>
    <div ref={overlayRef} className="scene-overlay">
      <StarSearch onSelect={visitSearchResult} onSelectBody={focusBody} destinos={[...localStars, ...localPlanets, ...moonBodies, ...NAVIGATION_TARGETS]}
        elegida={estrellaFicha && temperaturaFicha ? { nombre: nombreFicha, color: colorLegible(temperaturaFicha) } : null} />
      <BarraDistancia onViajar={viajarDesdeBarra} onSeguir={seguirBarra} />
      <div className="visores-vuelo"><DialDistancia titulo={distanceTitle(distanceTarget?.name || 'Sol')} />
      <DialVelocidad velocidad={speed} activo={freeFlight} viajando={traveling} onActivar={toggleFlight} onDesactivar={toggleFlight}
        onCambiar={valor=>{setSpeed(valor);setVelocidadSolicitada({valor});}} />
      </div>
      <div className="distance-panel logo-hoshi"><div className="eyebrow marca-hoshi">H O S H I</div></div>
      <nav className="scale-navigation" aria-label="Explorar escalas">
        <MenuVer acciones={acciones.filter(accion => !accion.fija)} onElegir={ejecutarAccion} />
        {acciones.filter(accion => accion.fija && !accion.oculta).map(accion => <button key={accion.id} data-accion={accion.id} aria-pressed={accion.activa} title={accion.titulo} onClick={() => ejecutarAccion(accion.id)}>{accion.texto}</button>)}
      </nav>
      <ControlesComputador acciones={acciones} vistaId={view.id} solApuntado={solApuntado} solEnFoco={solEnFoco} onElegir={ejecutarAccion} />
      {/* En el celular los mismos botones se agrupan en una lista desplegable. */}
      <label className="menu-explorar">
        <select aria-label="Ir a" value="" onChange={event => ejecutarAccion(event.target.value)}>
          <option value="" disabled>Ir a</option>
          {acciones.filter(accion => !accion.oculta).map(accion => <option key={accion.id} value={accion.id}>{accion.activa && accion.id !== 'vuelo-libre' ? '✓ ' : ''}{accion.textoLista || accion.texto}</option>)}
        </select>
      </label>
      <SelectorBrillo viajando={traveling} />
      {solEnFoco && !esComputador && <FiltrosSol />}
      {solEnFoco && !esComputador && <CreditoSDO filtro={filtroEstelar} />}
      {catalogueStatus === 'loading' && <div className="galaxy-loading" role="status">Cargando el catálogo de estrellas…</div>}
      {catalogueStatus === 'error' && <div className="galaxy-loading" role="status">No se pudo cargar el catálogo de estrellas. Recarga para reintentar.</div>}
      {galaxyStatus === 'loading' && <div className="galaxy-loading" role="status">Cargando la Vía Láctea…</div>}
      {galaxyStatus === 'error' && <div className="galaxy-loading" role="status">No se pudo cargar la galaxia. Recarga para reintentar.</div>}
      {view.id === 'heliosphere' && !showPulsars && showHeliosphere && <FichaHeliosfera />}
      {showDiscoveries && <PanelDescubrimientos data={discoveries.data} status={discoveries.status} filter={discoveryFilter}
        onFilter={setDiscoveryFilter} onClose={() => setShowDiscoveries(false)} />}
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
        <select aria-label="Acercarse a un cuerpo" value={focusedBody?.optionValue || focusedBody?.name || ''} onChange={event => {
          const name = event.target.value;
          const body = localMoons.find(b => b.optionValue === name) || localPlanets.find(b => b.name === name) || localStars.find(b => b.name === name) || (exoplanetBody && name === hostName ? starBody(hostStar, hostName) : NAVIGATION_TARGETS.find(b => b.name === name));
          if (body) focusBody(body);
        }}>
          <option value="" disabled>Viajar a…</option>
          {stellarBody && <option value={stellarBody.name}>{stellarBody.name}</option>}
          {exoplanetBody && <option value={hostName}>{hostName}</option>}
          {localStars.length > 0 && <optgroup label="Estrellas de este sistema">
            {localStars.filter(body => body.name !== stellarBody?.name).map(body => <option key={body.name} value={body.name}>{body.name}</option>)}
          </optgroup>}
          {localPlanets.length > 0 && <optgroup label="Planetas de este sistema">
            {localPlanets.map(body => <option key={body.name} value={body.name}>{body.name}</option>)}
          </optgroup>}
          {localMoons.length > 0 && <optgroup label={`Lunas de ${localMoons[0].planet} (${localMoons.length})`}>
            {localMoons.map(body => <option key={body.optionValue} value={body.optionValue}>{body.name}</option>)}
          </optgroup>}
          {NAVIGATION_TARGETS.map(body => <option key={body.name} value={body.name}>{body.name}</option>)}
        </select>
      </label>
      {aimTarget && aimTarget.kind !== 'sun' && <>
        <div className="aim-reticle" aria-hidden="true" />
      </>}
      {(fichaPlaneta || estrellaFicha) && <FichaLateral clave={fichaPlaneta ? `planeta:${nombreFicha}` : `estrella:${estrellaFicha.i}`} direccion={direccionFicha}
        etiqueta={`Información de ${nombreFicha}`} onCerrar={cerrarFicha}>
        {fichaPlaneta ? <FichaPlaneta planeta={exoplanetBody.planet} sistema={exoplanetBody.system} nombreEstrella={hostName}
          onVerEstrella={verEstrellaDesdeFicha} onVerPlaneta={body => { setDireccionFicha(1); focusBody(body); }} onZona={mostrarZona} />
          : <FichaEstrella nombre={nombreFicha} star={estrellaFicha} onVerPlaneta={verPlanetaDesdeFicha} onVerComponente={verComponenteDesdeFicha} onZona={mostrarZona}
            onVerSuperficie={() => visitBody(estrellaEnfocada ? panelBody : starBody(estrellaFicha, nombreFicha), true)}/>}
      </FichaLateral>}
      {!estrellaVista && showBodyPanel && panelBody && !stellarBody && !exoplanetBody && (<aside className="body-panel">
            <button className="panel-close" aria-label="Cerrar información" onClick={() => setShowBodyPanel(false)}>×</button>
            <strong>{panelBody.name}</strong>
            {detalle}
          </aside>)}
      <MoonLabels focused={focusedBody} onSelect={focusBody} />
      <div data-labels className="scene-labels">
        {labels.map((label, i) => <span key={i} className={`scene-label ${label.kind}${aimTarget === label ? ' is-target' : ''}`} style={{ color: label.color }}
          {...label.kind === 'probe' && { onPointerEnter: () => { probeHighlight.code = label.code; }, onPointerLeave: () => { probeHighlight.code = null; } }}>
          {label.kind === 'star' ? <button className="label-text" onClick={() => { setDireccionFicha(1); setEstrellaVista(label); }} onDoubleClick={() => aimAtStar(label)}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); aimAtStar(label); }
            }} title="Clic: ver su ficha · Doble clic: viajar a ella">{label.text}</button>
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
      <AvisoCelular />
      <PantallaCompleta />
      {traveling && !view.journey?.comparacion && <p className="subtitulo-escena visible" role="status">{TACTIL ? 'Toca la escena para detener el viaje' : 'Clic en la escena o Esc: detener el viaje'}</p>}
      <footer className="scene-footer">
        <span>© 2026 Sergio Bastidas</span>
      </footer>
    </div>
  </main>;
}
