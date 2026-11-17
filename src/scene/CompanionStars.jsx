import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { AdditiveBlending } from 'three';
import { smoothRange } from './scale';
import { barycentricOrbitsPc, companionOrbitPc, estrellaDeComponente, rectaAncha, colorCatalogo } from './visualBinary';
import OrbitLine from './OrbitLine';
import { indiceBusqueda } from '../indiceBusqueda';
import { nombreParaMostrar } from './nombresEstrella';
import { GENITIVOS } from './starSearch';

// Componentes de sistemas múltiples (ORB6 y WDS). Al acercarse, cada compañera deja de
// coincidir con el punto del catálogo. Los puntos son marcadores: su tamaño indica
// brillo relativo, no un radio estelar. Véase docs/BINARIAS.md.
const MAX_ACTIVE = 6;
// Distancias de aparición en múltiplos de la separación de cada componente.
const MARKER_RANGE = [250, 600], LINE_RANGE = [60, 300], LABEL_RANGE = [45, 110];

// ¿El campo de estrellas ya muestra el nombre de esa estrella (VisualGuides.jsx)? Entonces el extremo
// de la recta no repite punto ni nombre.
function nombreVisible(nombre) {
  for (const boton of document.querySelectorAll('[data-labels] .label-text')) {
    if (boton.textContent !== nombre) continue;
    const contenedor = boton.closest('[data-labels] > *');
    return contenedor && Number(contenedor.style.opacity || 1) > 0.05 && contenedor.style.display !== 'none';
  }
  return false;
}

// `elegido`: el sistema tiene la ficha abierta o el rumbo fijado en una de sus estrellas. Las rectas de
// los pares anchos (sin órbita) solo se dibujan entonces: unen estrellas a miles de UA y, sin elegir el
// sistema, se veían como líneas sueltas (Alula Australis D, enana café a 4.500 UA).
function CompanionSystem({ system, origin, onElegir, elegido }) {
  const lines = useRef(), material = useRef(), points = useRef(), labels = useRef([]);
  const position = useMemo(() => system.position.map((v, i) => v - origin[i]), [system, origin]);
  // Las compañeras que ya son un registro del catálogo se dibujan con el campo estelar.
  const drawn = useMemo(() => system.components.filter(component => !component.companion), [system]);
  // Una curva por par ancho u órbita relativa; con masas, las dos órbitas en torno al
  // centro de masas del par.
  // Cada órbita lleva el color de su estrella en el cielo, con un brillo detrás; la recta de un par ancho,
  // el de la compañera, sin brillo.
  const paths = useMemo(() => system.components.flatMap(component => {
    const shifted = points => new Float32Array(points.flatMap(p => p.map((v, i) => v + component.parentOffsetPc[i])));
    const rgb = star => `rgb(${colorCatalogo(star).join(',')})`;
    if (component.pair.k !== 'o') return component.unido ? [{ component, ...rectaAncha(component), tinte: rgb(estrellaDeComponente(system, component)) }] : [];
    const padre = component.pair.of === 'A' ? system.star : system.components.find(c => c.name === component.pair.of);
    const estrellaPadre = padre === system.star ? padre : padre && estrellaDeComponente(system, padre);
    const companera = rgb(estrellaDeComponente(system, component));
    if (component.massRatio === null) return [{ component, points: shifted(companionOrbitPc(component.pair, system.position)), color: companera }];
    const orbits = barycentricOrbitsPc(component.pair, system.position, component.massRatio);
    return [{ component, points: shifted(orbits.companion), color: companera },
      { component, points: shifted(orbits.primary), color: estrellaPadre ? rgb(estrellaPadre) : companera }];
  }), [system]);
  const brillos = useRef([]);
  // Compañeras lejanas con registro propio (Proxima): mientras se ve su recta, un punto chico en su color
  // y su nombre en el extremo, para que la recta no termine en el vacío cuando el campo de estrellas
  // no la muestra por débil.
  const extremos = useMemo(() => paths.map((path, i) => ({ path, i })).filter(({ path }) => path.component.pair.k !== 'o' && path.component.companion)
    .map(({ path, i }) => ({ i, component: path.component, color: `rgb(${colorCatalogo(path.component.companion).join(',')})` })), [paths]);
  const marcas = useRef([]);
  // Compañera con registro propio pero sin nombre propio (61 Cygni B): el título de su ficha y del buscador. El número
  // WDS queda solo para las compañeras sin registro.
  const [titulos, setTitulos] = useState(() => new Map());
  useEffect(() => {
    const buscados = new Set(extremos.filter(({ component }) => !component.companion.n).map(({ component }) => component.companion.i));
    if (!buscados.size) return;
    let vigente = true;
    indiceBusqueda().then(indice => {
      if (vigente) setTitulos(new Map(indice.filter(item => buscados.has(item.id)).map(item => [item.id, nombreParaMostrar(item.aliases[0], GENITIVOS)])));
    }, () => {});
    return () => { vigente = false; };
  }, [extremos]);
  const nombreExtremo = component => component.companion.n || titulos.get(component.companion.i) || component.label;
  const attributes = useMemo(() => ({
    position: new Float32Array(drawn.flatMap(component => component.offsetPc)),
    color: new Float32Array(drawn.flatMap(component => component.color.map(v => v / 255))),
    size: new Float32Array(drawn.map(component => component.sizePx)),
    alpha: new Float32Array(drawn.length),
  }), [drawn]);
  const uniforms = useMemo(() => ({ pixelRatio: { value: 1 } }), []);
  useFrame(({ camera, gl }) => {
    const range = component => Math.hypot(camera.position.x - position[0] - component.offsetPc[0],
      camera.position.y - position[1] - component.offsetPc[1], camera.position.z - position[2] - component.offsetPc[2]) / component.scalePc;
    paths.forEach(({ component }, i) => {
      const line = lines.current.children[i];
      line.material.opacity = (component.pair.k === 'o' ? 0.45 : elegido ? 0.14 : 0) * (1 - smoothRange(range(component), ...LINE_RANGE));
      line.visible = line.material.opacity > 0.003;
      const brillo = brillos.current[i];
      if (brillo) { brillo.material.opacity = 0.16 * line.material.opacity / 0.45; brillo.visible = line.visible; }
      const marca = marcas.current[i];
      if (marca) {
        marca.style.opacity = line.visible && !nombreVisible(marca.textContent) ? Math.min(1, line.material.opacity / 0.1).toFixed(3) : '0';
        marca.style.pointerEvents = marca.style.opacity > 0.5 ? 'auto' : 'none';
      }
    });
    drawn.forEach((component, i) => {
      const distance = range(component);
      attributes.alpha[i] = 1 - smoothRange(distance, ...MARKER_RANGE);
      const label = labels.current[i];
      if (label) {
        label.style.opacity = 1 - smoothRange(distance, ...LABEL_RANGE);
        label.style.pointerEvents = label.style.opacity > 0.5 ? 'auto' : 'none';
      }
    });
    if (points.current) points.current.geometry.attributes.alpha.needsUpdate = true;
    if (material.current) material.current.uniforms.pixelRatio.value = gl.getPixelRatio();
  });
  return <group position={position}>
    <group ref={lines}>
      {paths.map((path, i) => <line key={i} frustumCulled={false} position={path.anchor}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[path.points, 3]} /></bufferGeometry>
        <lineBasicMaterial color={path.color || path.tinte} transparent opacity={0} depthWrite={false} />
      </line>)}
    </group>
    {paths.map((path, i) => path.color && <OrbitLine key={`brillo-${i}`} ref={linea => { brillos.current[i] = linea; }} points={path.points}
      variant="brillo" color={path.color} visible />)}
    {extremos.map(({ i, component, color }) => <Html key={`extremo-${component.name}`} position={component.offsetPc} zIndexRange={[18, 10]} style={{ pointerEvents: 'none' }}>
      <span ref={element => { marcas.current[i] = element; }} className="companion-extremo" style={{ opacity: 0, '--color': color }} title="Doble clic: fijarla"
        onDoubleClick={() => onElegir?.(component.companion, nombreExtremo(component))}>{nombreExtremo(component)}</span>
    </Html>)}
    {drawn.length > 0 && <points ref={points} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[attributes.position, 3]} />
        <bufferAttribute attach="attributes-color" args={[attributes.color, 3]} />
        <bufferAttribute attach="attributes-size" args={[attributes.size, 1]} />
        <bufferAttribute attach="attributes-alpha" args={[attributes.alpha, 1]} />
      </bufferGeometry>
      <shaderMaterial ref={material} transparent depthWrite={false} toneMapped={false} blending={AdditiveBlending} uniforms={uniforms}
        vertexShader={`
          uniform float pixelRatio;
          attribute vec3 color;
          attribute float size;
          attribute float alpha;
          varying vec3 tint;
          varying float fade;
          #include <common>
          #include <logdepthbuf_pars_vertex>
          void main() {
            tint = color;
            fade = alpha;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = size * pixelRatio;
            #include <logdepthbuf_vertex>
          }`}
        fragmentShader={`
          varying vec3 tint;
          varying float fade;
          #include <logdepthbuf_pars_fragment>
          void main() {
            vec2 p = gl_PointCoord * 2.0 - 1.0;
            float r2 = dot(p, p);
            float alpha = exp(-r2 * 9.0) + 0.18 * exp(-r2 * 3.0);
            gl_FragColor = vec4(tint, fade * alpha * (1.0 - smoothstep(0.65, 1.0, r2)));
            #include <logdepthbuf_fragment>
          }`} />
    </points>}
    {drawn.map((component, i) => <Html key={component.name} position={component.offsetPc} zIndexRange={[18, 10]} style={{ pointerEvents: 'none' }}>
      <span ref={element => { labels.current[i] = element; }} className="companion-label" style={{ opacity: 0 }} title="Doble clic: fijarla"
        onDoubleClick={() => onElegir?.(estrellaDeComponente(system, component), `${system.star.n} ${component.name}`)}>{component.label}</span>
    </Html>)}
  </group>;
}

// Ids de catálogo de una estrella del sistema: la principal, las compañeras con registro propio y las que
// se completan con el dato del par (estrellaDeComponente).
const idsDelSistema = system => [system.star.i, ...system.components.flatMap(c => [c.companion?.i, `${system.star.i}-${c.name}`])];

export default function CompanionStars({ systems, origin, onElegir, elegidos = [] }) {
  const [active, setActive] = useState([]);
  const key = useRef('');
  useFrame(({ camera }) => {
    const x = camera.position.x + origin[0], y = camera.position.y + origin[1], z = camera.position.z + origin[2];
    const near = [];
    for (const system of systems) {
      const distance = Math.hypot(x - system.position[0], y - system.position[1], z - system.position[2]);
      if (distance < system.rangePc * MARKER_RANGE[1]) near.push({ system, distance });
    }
    near.sort((a, b) => a.distance - b.distance);
    const next = near.slice(0, MAX_ACTIVE).map(entry => entry.system);
    const nextKey = next.map(system => system.id).join(',');
    if (nextKey !== key.current) { key.current = nextKey; setActive(next); }
  });
  const buscados = elegidos.filter(id => id !== undefined && id !== null);
  return active.map(system => <CompanionSystem key={system.id} system={system} origin={origin} onElegir={onElegir}
    elegido={buscados.length > 0 && idsDelSistema(system).some(id => buscados.includes(id))} />);
}
