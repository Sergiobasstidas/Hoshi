import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Color, Vector3 } from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { AU_TO_PC, KM_TO_PC, LIGHT_YEAR_PC, PLANETS, smoothRange, solarDistance } from './scale';
import OrbitLine from './OrbitLine';
import { anchorHidden, currentOccluders, rayHidden } from './labelOcclusion';
import { PROBE_COLOR, markRouteClick, markRouteMissed, probeHidden, probeHighlight, probeLit, probeSamples, useProbes } from './probeTrajectories';
import { advanceFlyby, flybyKey, playback } from './flybyPlayback';
import { ARC_AU, FLYBY_PLANETS, addFlybyGhost, composeRoute, routeChunks, flybyArcPc, flybyArrows, flybyBody, flybyCurvePc, pick, thinIndices, useFlybys } from './probeFlybys';

// Rutas completas de Voyager 1 y 2 y Pioneer 10 y 11: su trayectoria real de Horizons desde el
// lanzamiento hasta la posición de la fecha, con los tramos densos de los pasos por planetas.
// Se enciende con «Rutas de sondas» en «Mostrar» (apagado por defecto); la de la sonda elegida se ve
// aunque esté apagado. Es una línea fina y tenue como las órbitas del sistema solar (OrbitLine,
// variante `fina`), en el gris de las sondas. Cada ruta aparece según los píxeles que ocupa la
// distancia de su sonda al Sol, como una órbita según su radio, y todas se retiran entre 0,019 y
// 0,02 años luz, como la etiqueta. Al pasar el ratón por una ruta se resalta con su sonda, como al
// pasar por el nombre; un clic la deja marcada (resaltada, con sus planetas de entonces) sin mover la
// cámara, y un doble clic viaja a la sonda.
// En cada sobrevuelo, al acercarse al planeta de entonces, el tramo heliocéntrico se funde con la
// curva de Horizons con centro en el planeta (probeFlybys.js), dibujada respecto de él: una esfera de alambre de radio real
// en la posición del máximo acercamiento, con un punto y «Júpiter · 1979» mientras la ruta está
// resaltada o elegida, o con la cámara cerca.
const FADE_PIXELS = [8, 35];
const HOVER_COLOR = new Color('#e6e9ee'), BASE_COLOR = new Color(PROBE_COLOR);
// Margen en píxeles a cada lado del trazo para pasar el ratón por la ruta.
const HIT_PIXELS = 7;
// Con la cámara a menos de esta distancia de la ruta, se dibuja respecto de un punto cercano.
const ANCHOR_AU = 0.5;
// Distancia de la cámara al planeta de entonces (UA) desde la que se muestra su nombre sin resaltar.
const NEAR_FLYBY_AU = 0.05;
// Nivel de detalle: con miles de tramos de menos de un píxel uno encima de otro, la mezcla aditiva
// dibujaría un punto brillante. Cada tramo usa el nivel cuyo espaciado ocupa menos de unos 3 px a la
// distancia de la cámara a su ancla (el planeta de entonces o el extremo más cercano del tramo),
// hasta las muestras completas (de hasta un minuto en los sobrevuelos).
const LEVELS_KM = [300000, 30000, 3000, 300];
const LEVEL_PIXELS = 3;
// Fundido por profundidad, con la cámara cerca de la ruta (a D de ella): lo que está a más de
// max(DEPTH_FADE[0]·D, DEPTH_MIN_AU[0]) de la cámara se atenúa hasta apagarse a
// max(DEPTH_FADE[1]·D, DEPTH_MIN_AU[1]). En perspectiva, decenas de UA de ruta que se alejan se
// comprimirían hacia su punto de fuga y, con la mezcla aditiva, formarían un extremo brillante. Se
// calcula en el sombreador con la distancia de cada vértice a la cámara: es continuo, sin saltos.
const DEPTH_FADE = [8, 32], DEPTH_MIN_AU = [1, 10];

// La ruta: una sola línea en el marco heliocéntrico, con el detalle de los sobrevuelos (composeRoute),
// en tramos: el crucero con puntos fijos y cada sobrevuelo con niveles de detalle según la cámara se
// acerque a su planeta (la forma de un tramo solo cambia cuando la cámara está cerca de él).
// `anchor`: punto de la ruta cercano a la cámara (pc, doble precisión) que sirve de origen a la geometría.
function Route({ chunks, probe, origin, active, handlers, anchor, fade }) {
  return <>{chunks.map((chunk, i) => <RouteChunk key={i} chunk={chunk} probe={probe} origin={origin} active={active}
    handlers={handlers} anchor={anchor} fade={fade} />)}</>;
}

function RouteChunk({ chunk, probe, origin, active, handlers, anchor, fade }) {
  const lines = useRef([]), lit = useRef(0);
  const levels = useMemo(() => (chunk.planetPc ? LEVELS_KM : LEVELS_KM.slice(0, 1)).map(km => thinIndices(chunk.points, km * KM_TO_PC)), [chunk]);
  // Coordenadas que recibe la tarjeta gráfica (32 bits): respecto del punto de referencia cercano a la
  // cámara (o absolutas si la cámara está lejos de la ruta). Así, junto a una sonda a 170 UA, la línea
  // no tiembla y llega hasta ella.
  const origin3 = anchor?.near ? anchor.point : null;
  const located = useMemo(() => levels.map(kept => {
    const picked = pick(chunk.points, kept);
    return origin3 ? Float32Array.from(picked, (value, k) => value - origin3[k % 3]) : Float32Array.from(picked);
  }), [levels, chunk, origin3]);
  useFrame(({ camera, size }, delta) => {
    const focal = size.height / (2 * Math.tan(camera.fov * Math.PI / 360));
    let level = 0;
    if (chunk.planetPc) {
      const distance = Math.hypot(camera.position.x + origin[0] - chunk.planetPc[0], camera.position.y + origin[1] - chunk.planetPc[1],
        camera.position.z + origin[2] - chunk.planetPc[2]);
      while (level < levels.length - 1 && LEVELS_KM[level] * KM_TO_PC / distance * focal > LEVEL_PIXELS) level++;
    }
    lines.current.forEach((line, i) => { if (line && i !== level) line.visible = false; });
    const object = lines.current[level];
    if (!object) return;
    const cameraPc = solarDistance(camera.position, origin);
    lit.current += ((active() ? 1 : 0) - lit.current) * (1 - Math.exp(-12 * delta));
    const opacity = (probeHidden(probe.code) ? 0 : 1) * smoothRange(Math.hypot(...probe.position) / cameraPc * focal, ...FADE_PIXELS)
      * (1 - smoothRange(cameraPc, 0.019 * LIGHT_YEAR_PC, 0.02 * LIGHT_YEAR_PC));
    object.visible = opacity > 0.005;
    object.material.opacity = Math.min(1, opacity * (1 + 1.6 * lit.current));
    object.material.color.copy(BASE_COLOR).lerp(HOVER_COLOR, lit.current);
    if (object.material.userData.depthFade) object.material.userData.depthFade.value = fade.current;
  });
  useEffect(() => { lines.current.forEach(line => { if (line) line.raycast = hitTest; }); }, [located]);
  const routes = located.map((positions, i) => <OrbitLine key={i} ref={line => { lines.current[i] = line; }} points={positions}
    variant="fina" color={PROBE_COLOR} visible depthFade />);
  return <group {...handlers}>{origin3 ? <group position={origin3}>{routes}</group> : routes}</group>;
}

// Solo se buscan las rutas que se ven; el margen se suma al ancho del trazo (Line2). Los tramos
// tapados por un planeta, una luna o el Sol, más cercanos a la cámara, no cuentan.
function hitTest(raycaster, intersects) {
  if (!this.visible || this.material.opacity < 0.05) return;
  const previous = raycaster.params.Line2, before = intersects.length;
  raycaster.params.Line2 = { threshold: HIT_PIXELS };
  Line2.prototype.raycast.call(this, raycaster, intersects);
  raycaster.params.Line2 = previous;
  if (intersects.length === before) return;
  const disks = currentOccluders();
  let kept = before;
  for (let i = before; i < intersects.length; i++) {
    if (!rayHidden(raycaster.ray, intersects[i].distance, disks)) intersects[kept++] = intersects[i];
  }
  intersects.length = kept;
}

const ahead = new Vector3(), here = new Vector3();
// Planeta de entonces: esfera de alambre a su radio real, punto y nombre con el año. Cuando la curva
// ya se distingue, dos marcas finas sobre ella indican el sentido en que la sonda la recorrió.
function FlybyPlanet({ ghost, probeName, origin, active, onSelect }) {
  const { flyby, planetPc } = ghost;
  const probeAt = useRef(null);
  const sphere = useRef(), label = useRef(), arrows = useRef([]), probeDot = useRef(), probeGroup = useRef();
  // Marcas de sentido sobre la ruta (heliocéntrica), donde la sonda está al doble de la distancia mínima.
  const marks = useMemo(() => flybyArrows(flyby, flybyCurvePc(flyby).points).map(mark => {
    const at = t => ghost.probeAt(t).map((value, a) => value - planetPc[a]);
    const before = at(mark.jd - 0.01), after = at(mark.jd + 0.01);
    return { position: at(mark.jd), direction: after.map((value, a) => value - before[a]) };
  }), [flyby, ghost, planetPc]);
  // Animación del paso (flybyPlayback.js): el planeta y la sonda avanzan; la cámara no se mueve.
  const key = flybyKey(flyby.code, FLYBY_PLANETS[flyby.planet]);
  useFrame((_, delta) => {
    const state = playback();
    const playing = state.key === key && state.t !== null;
    if (playing) advanceFlyby(delta);
    const t = playing ? Math.min(Math.max(playback().t ?? flyby.closestJd, ghost.first), ghost.last) : null;
    if (sphere.current) sphere.current.position.fromArray(playing ? ghost.planetAt(t).map((value, a) => value - planetPc[a]) : [0, 0, 0]);
    if (probeGroup.current) probeGroup.current.position.fromArray(playing ? ghost.probeAt(t).map((value, a) => value - planetPc[a]) : [0, 0, 0]);
    probeAt.current = playing ? ghost.probeAt(t).map((value, a) => value - planetPc[a]) : null;
  });
  // Arco de su órbita real (± 60 días), con el estilo de las órbitas; pasa por el planeta de entonces.
  const arc = useRef();
  const arcPoints = useMemo(() => flybyArcPc(flyby), [flyby]);
  useEffect(() => addFlybyGhost(FLYBY_PLANETS[flyby.planet], planetPc), [flyby, planetPc]);
  const planet = PLANETS.find(item => item.name === FLYBY_PLANETS[flyby.planet]);
  const radiusPc = planet.radiusKm * KM_TO_PC;
  const year = new Date((flyby.closestJd - 2440587.5) * 86400000).getUTCFullYear();
  const body = useMemo(() => flybyBody(flyby, planet, planetPc, year), [flyby, planet, planetPc, year]);
  useFrame(({ camera, size }) => {
    const distance = Math.hypot(camera.position.x + origin[0] - planetPc[0], camera.position.y + origin[1] - planetPc[1],
      camera.position.z + origin[2] - planetPc[2]);
    // Nombre, sonda animada y marcas no se ven ni se pueden pulsar detrás de un cuerpo más cercano
    // (también el planeta de hoy con el mismo nombre); la esfera de alambre no tapa nada.
    const disks = currentOccluders(camera, size);
    const covered = (offset, width = 0, left = 0) => anchorHidden(planetPc[0] - origin[0] + offset[0], planetPc[1] - origin[1] + offset[1],
      planetPc[2] - origin[2] + offset[2], camera, size, width, left, disks);
    const focal = size.height / (2 * Math.tan(camera.fov * Math.PI / 360));
    const near = 1 - smoothRange(distance, NEAR_FLYBY_AU * AU_TO_PC, NEAR_FLYBY_AU * 2 * AU_TO_PC);
    // Como los nombres de los planetas, se retira cuando la órbita del planeta ocupa pocos píxeles.
    const cameraPc = solarDistance(camera.position, origin);
    const orbitPixels = Math.hypot(...planetPc) / cameraPc * focal;
    const shown = (probeHidden(flyby.code) ? 0 : 1) * Math.max(active() ? smoothRange(orbitPixels, 80, 160) : 0, near)
      * (1 - smoothRange(cameraPc, 0.019 * LIGHT_YEAR_PC, 0.02 * LIGHT_YEAR_PC));
    const spherePixels = radiusPc / distance * focal;
    if (arc.current) {
      arc.current.material.opacity = 1 - smoothRange(distance, ARC_AU[0] * AU_TO_PC, ARC_AU[1] * AU_TO_PC);
      arc.current.visible = arc.current.material.opacity > 0.005;
    }
    if (sphere.current) {
      sphere.current.material.opacity = 0.22 * shown * smoothRange(spherePixels, 2, 6);
      sphere.current.visible = sphere.current.material.opacity > 0.005;
    }
    if (label.current) {
      const visible = shown > 0.02 && !covered([0, 0, 0], Math.min(spherePixels, size.width / 3) + 9 + label.current.textContent.length * 6.2 + 8);
      label.current.style.opacity = shown;
      label.current.style.visibility = visible ? 'visible' : 'hidden';
      label.current.style.setProperty('--punto', 1 - smoothRange(spherePixels, 3, 6));
      label.current.style.setProperty('--borde', `${Math.min(spherePixels, size.width / 3)}px`);
    }
    if (probeDot.current) {
      const visible = probeAt.current && !covered(probeAt.current, 14 + probeName.length * 6.2 + 8, 7);
      probeDot.current.style.opacity = visible ? 1 : 0;
      probeDot.current.style.visibility = visible ? 'visible' : 'hidden';
    }
    const curvePixels = flyby.closestKm * KM_TO_PC / distance * focal;
    marks.forEach((mark, i) => {
      const element = arrows.current[i];
      if (!element) return;
      const alpha = shown * smoothRange(curvePixels, 25, 60) * (covered(mark.position) ? 0 : 1);
      element.style.opacity = alpha * 0.8;
      if (alpha < 0.02) return;
      here.set(...mark.position).add({ x: planetPc[0] - origin[0], y: planetPc[1] - origin[1], z: planetPc[2] - origin[2] }).project(camera);
      ahead.set(...mark.position.map((value, axis) => value + mark.direction[axis])).add({ x: planetPc[0] - origin[0], y: planetPc[1] - origin[1], z: planetPc[2] - origin[2] }).project(camera);
      element.style.transform = `translate(-50%, -50%) rotate(${Math.atan2(-(ahead.y - here.y) * size.height, (ahead.x - here.x) * size.width)}rad)`;
    });
  });
  return <group position={planetPc}>
    <OrbitLine ref={arc} points={arcPoints} variant="fina" />
    <mesh ref={sphere} scale={radiusPc} raycast={() => null}>
      <sphereGeometry args={[1, 24, 12]} />
      <meshBasicMaterial color={planet.color} wireframe transparent opacity={0} depthWrite={false} toneMapped={false} />
    </mesh>
    <group ref={probeGroup}>
      <Html zIndexRange={[19, 11]} style={{ pointerEvents: 'none' }}>
        <span ref={probeDot} className="sonda-entonces sonda-animada" style={{ opacity: 0 }}>{probeName}</span>
      </Html>
    </group>
    <Html zIndexRange={[18, 10]} style={{ pointerEvents: 'none' }}>
      <button ref={label} className="sobrevuelo" style={{ color: planet.color, opacity: 0, visibility: 'hidden' }}
        onClick={() => onSelect?.(body)} title={`Acercarse a ${planet.name} en el paso de la sonda`}>
        <span>{planet.name} · {year}</span>
      </button>
    </Html>
    {marks.map((mark, i) => <Html key={i} position={mark.position} zIndexRange={[18, 10]} style={{ pointerEvents: 'none' }}>
      <svg ref={element => { arrows.current[i] = element; }} className="sentido-sobrevuelo" viewBox="0 0 10 10" style={{ opacity: 0 }} aria-hidden="true">
        <path d="M3 1.5 7 5 3 8.5" />
      </svg>
    </Html>)}
  </group>;
}

const setCursor = (gl, value) => { gl.domElement.style.cursor = value; };

function ProbeRoute({ probe, origin, flybys, selected, onSelect, onAim }) {
  const gl = useThree(state => state.gl);
  const route = useMemo(() => {
    const own = flybys.filter(flyby => flyby.code === probe.code);
    const composed = composeRoute(probe.trail, probeSamples(probe.data).jd, probe.data, own);
    return { ...composed, chunks: routeChunks(composed.points, composed.windows) };
  }, [probe, flybys]);
  // Fundido por profundidad (continuo): [desde, hasta] en pc, según la distancia D de la cámara a la ruta.
  const fade = useRef([1e9, 2e9]);
  // Punto de la ruta más cercano a la cámara y su distancia: elige el nivel de detalle y, a menos de
  // ANCHOR_AU, sirve de origen a la geometría. Se rehace al acercarse o alejarse el doble, o si el punto
  // más cercano se desplaza más que esa distancia.
  const [anchor, setAnchor] = useState(null);
  const anchorRef = useRef(null);
  useFrame(({ camera }) => {
    const points = route.points, x = camera.position.x + origin[0], y = camera.position.y + origin[1], z = camera.position.z + origin[2];
    let best = 0, bestDistance = Infinity;
    for (let i = 0; i < points.length; i += 3) {
      const d = (points[i] - x) ** 2 + (points[i + 1] - y) ** 2 + (points[i + 2] - z) ** 2;
      if (d < bestDistance) { bestDistance = d; best = i; }
    }
    bestDistance = Math.max(Math.sqrt(bestDistance), 1e-13);
    fade.current = bestDistance < ANCHOR_AU * AU_TO_PC
      ? [Math.max(DEPTH_FADE[0] * bestDistance, DEPTH_MIN_AU[0] * AU_TO_PC), Math.max(DEPTH_FADE[1] * bestDistance, DEPTH_MIN_AU[1] * AU_TO_PC)]
      : [1e9, 2e9];
    const near = bestDistance < ANCHOR_AU * AU_TO_PC;
    const current = anchorRef.current;
    const moved = current ? Math.hypot(current.point[0] - points[best], current.point[1] - points[best + 1], current.point[2] - points[best + 2]) : Infinity;
    if (!current || near !== current.near || bestDistance > 2 * current.distance || bestDistance < current.distance / 2 || moved > bestDistance) {
      anchorRef.current = { point: [points[best], points[best + 1], points[best + 2]], distance: bestDistance, near };
      setAnchor(anchorRef.current);
    }
  });
  const active = () => probeLit(probe.code) || selected === probe.code;
  // Un clic (o doble clic) marca la ruta y elige la sonda; la cámara sale a ver la ruta entera (App.jsx).
  // Un clic en el vacío la suelta desde la escena (App.jsx), que no lo hace durante un viaje.
  const handlers = {
    onPointerOver: event => { event.stopPropagation(); probeHighlight.code = probe.code; setCursor(gl, 'pointer'); },
    onPointerOut: () => { if (probeHighlight.code === probe.code) probeHighlight.code = null; setCursor(gl, ''); },
    onClick: event => { event.stopPropagation(); markRouteClick(probe.code); onAim?.(probe); },
    onDoubleClick: event => { event.stopPropagation(); markRouteClick(probe.code); },
  };
  useEffect(() => () => { setCursor(gl, ''); markRouteMissed(probe.code); }, [gl, probe.code]);
  useEffect(() => {
    const onKey = event => { if (event.key === 'Escape') markRouteMissed(probe.code); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [probe.code]);
  return <>
    <Route chunks={route.chunks} probe={probe} origin={origin} active={active} handlers={handlers} anchor={anchor} fade={fade} />
    {route.ghosts.map(ghost => <FlybyPlanet key={ghost.flyby.planet} ghost={ghost} probeName={probe.name}
      origin={origin} active={active} onSelect={onSelect} />)}
  </>;
}

// `codes`: sondas cuya ruta se dibuja (todas si es nulo); `selected`: código de la sonda elegida.
export default function ProbeTrails({ origin, codes = null, selected = null, onSelect, onAim }) {
  const { probes } = useProbes();
  const { flybys } = useFlybys();
  return <>{probes.filter(probe => !codes || codes.includes(probe.code)).map(probe => <ProbeRoute key={probe.code} probe={probe}
    origin={origin} flybys={flybys} selected={selected} onSelect={onSelect} onAim={onAim} />)}</>;
}
