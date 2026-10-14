import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { temperatureColor } from './stellarPhysics.js';
import { LIGHT_YEAR_PC } from './scale.js';
import { MISSION_COLORS, PLANET_TYPES, describeSystem, dominantType, filterSystems } from './descubrimientos.js';

// Destello de cuatro puntas por sistema planetario, como en Eyes on Exoplanets: núcleo
// blanco, halo del color elegido y rayos finos que titilan levemente. Los sistemas solo
// con candidatos llevan un anillo y rayos más cortos. Tamaño fijo en pantalla.
const vertexShader = `
  attribute vec3 tint; attribute float size; attribute float candidate; attribute float phase;
  uniform float pixelRatio; uniform float time; uniform float scale; uniform float focus;
  varying vec3 vTint; varying float vCandidate; varying float vTwinkle; varying float vDepth;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main(){
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // Más grandes los sistemas por delante del punto mirado y menores los de detrás:
    // da profundidad sin perder el tamaño de marcador.
    float depth = clamp(sqrt(focus / max(length(mv.xyz), 1e-6)), 0.55, 1.5);
    gl_PointSize = size * scale * depth * pixelRatio;
    vDepth = smoothstep(0.55, 1.0, depth);
    vTint = tint; vCandidate = candidate;
    vTwinkle = 0.8 + 0.2 * sin(time * (0.7 + fract(phase * 7.31)) + phase * 6.2832);
    #include <logdepthbuf_vertex>
  }`;
const fragmentShader = `
  uniform float intensity;
  varying vec3 vTint; varying float vCandidate; varying float vTwinkle; varying float vDepth;
  #include <logdepthbuf_pars_fragment>
  void main(){
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(p, p);
    if (r2 > 1.0) discard;
    float reach = mix(1.0, 0.6, vCandidate);
    // Rayos: estrechos en un eje y decrecientes a lo largo del otro.
    float spikeX = exp(-abs(p.y) * 60.0) * pow(max(0.0, 1.0 - abs(p.x) / reach), 2.6);
    float spikeY = exp(-abs(p.x) * 60.0) * pow(max(0.0, 1.0 - abs(p.y) / reach), 2.6);
    float spikes = (spikeX + spikeY) * vTwinkle;
    float core = exp(-r2 * mix(170.0, 230.0, vCandidate));
    float halo = exp(-r2 * 26.0) * mix(0.42, 0.2, vCandidate);
    float ring = vCandidate * exp(-pow((sqrt(r2) - 0.3) * 18.0, 2.0)) * 0.7;
    // Mezcla normal, no aditiva: donde se agolpan miles (campo de Kepler, vecindario de
    // TESS) queda el color de las estrellas y no una mancha blanca.
    float alpha = clamp(core * 1.4 + halo + spikes + ring, 0.0, 1.0) * intensity * mix(0.65, 1.0, vDepth);
    vec3 color = mix(vTint, vec3(1.0), clamp((core * 1.6 + spikes * 0.12) * intensity, 0.0, 1.0));
    gl_FragColor = vec4(color, alpha);
    #include <logdepthbuf_fragment>
  }`;

const hex = value => new THREE.Color(value).toArray();
const TYPE_TINTS = PLANET_TYPES.map(type => hex(type.color));
const MISSION_TINTS = MISSION_COLORS.map(hex);
// Sin temperatura (casi todos los de microlente): blanco, como en Eyes.
const UNKNOWN_STAR = [0.94, 0.95, 1];
// Color de estrella saturado un poco: el blanco del núcleo ya da el brillo.
function starTint(teff) {
  if (!teff) return UNKNOWN_STAR;
  const [r, g, b] = temperatureColor(teff);
  const mean = (r + g + b) / 3;
  return [r, g, b].map(v => Math.max(0, Math.min(1, mean + (v - mean) * 2.3)));
}
function tintOf(data, index, list, mode) {
  if (mode === 'tipo') return TYPE_TINTS[dominantType(data, list)];
  if (mode === 'mision') return MISSION_TINTS[data.facilities[data.planets.f[list[0]]].g];
  return starTint(data.systems.k[index]);
}

const lightYears = value => value < 100 ? value.toLocaleString('es-CL', { maximumFractionDigits: 1 })
  : Math.round(value).toLocaleString('es-CL', { maximumSignificantDigits: 3 });

export default function ExoplanetDiscoveries({ data, filter, origin, onSelect }) {
  const { camera, gl, size } = useThree();
  const material = useRef(), sunLabel = useRef();
  const matches = useMemo(() => filterSystems(data, filter), [data, filter]);
  const visible = useMemo(() => {
    const indices = [...matches.keys()];
    const position = new Float32Array(indices.length * 3), tint = new Float32Array(indices.length * 3);
    const sizes = new Float32Array(indices.length), candidate = new Float32Array(indices.length), phase = new Float32Array(indices.length);
    indices.forEach((index, n) => {
      const list = matches.get(index);
      // Restar el origen en doble precisión antes de pasar a Float32.
      for (let axis = 0; axis < 3; axis++) position[n * 3 + axis] = data.systems.p[index * 3 + axis] - origin[axis];
      tint.set(tintOf(data, index, list, filter.color), n * 3);
      sizes[n] = 15 + 6 * Math.log2(list.length);
      candidate[n] = list.every(k => data.planets.c[k]) ? 1 : 0;
      phase[n] = (index * 0.618034) % 1;
    });
    return { indices, position, tint, sizes, candidate, phase };
  }, [data, matches, origin, filter.color]);
  const uniforms = useMemo(() => ({ pixelRatio: { value: 1 }, time: { value: 0 }, scale: { value: 1 }, focus: { value: 1 }, intensity: { value: 1 } }), []);
  useFrame(({ clock }) => {
    if (!material.current) return;
    const u = material.current.uniforms;
    u.time.value = clock.elapsedTime;
    u.pixelRatio.value = gl.getPixelRatio();
    // De lejos los destellos se agolpan (el campo de Kepler, el bulbo): menores y más
    // tenues para que no se fundan en una mancha blanca.
    const solar = Math.hypot(camera.position.x + origin[0], camera.position.y + origin[1], camera.position.z + origin[2]);
    const far = THREE.MathUtils.clamp(Math.log10(Math.max(solar, 1) / 150) / 2.3, 0, 1);
    u.scale.value = (size.width < 700 ? 0.8 : 1) * (1.1 - 0.25 * far);
    // Se atenúa la galaxia, no los destellos: desde fuera deben destacar sobre el disco.
    u.intensity.value = 1 - 0.12 * far;
    u.focus.value = Math.max(solar, 1e-3);
    // Lejos, el rótulo del Sol lo pone la Vía Láctea.
    if (sunLabel.current) sunLabel.current.style.opacity = String(1 - THREE.MathUtils.smoothstep(solar, 450, 650));
    // Si la cámara se mueve bajo un puntero quieto, rehacer la selección.
    if (refresh.current && clock.elapsedTime - refresh.current.time > 0.25) { refresh.current.time = clock.elapsedTime; refresh.current.run(); }
  });

  // Selección en pantalla: el destello más cercano al puntero a menos de 14 px.
  const [hovered, setHovered] = useState(null);
  const pending = useRef(false), press = useRef(null), refresh = useRef(null);
  useEffect(() => {
    const element = gl.domElement;
    const point = new THREE.Vector3();
    const nearest = event => {
      const rect = element.getBoundingClientRect();
      const mx = event.clientX - rect.left, my = event.clientY - rect.top;
      let best = null, bestDistance = 14 * 14;
      const { position, indices } = visible;
      for (let n = 0; n < indices.length; n++) {
        point.set(position[n * 3], position[n * 3 + 1], position[n * 3 + 2]).project(camera);
        if (point.z > 1 || point.z < -1) continue;
        const dx = (point.x + 1) / 2 * rect.width - mx, dy = (1 - point.y) / 2 * rect.height - my;
        const distance = dx * dx + dy * dy;
        if (distance < bestDistance) { bestDistance = distance; best = n; }
      }
      return best === null ? null : indices[best];
    };
    const move = event => {
      refresh.current = { time: 0, run: () => {
        const index = nearest(event);
        element.style.cursor = index !== null ? 'pointer' : '';
        setHovered(index);
      } };
      if (pending.current || event.buttons) return;
      pending.current = true;
      requestAnimationFrame(() => {
        pending.current = false;
        const index = nearest(event);
        element.style.cursor = index !== null ? 'pointer' : '';
        setHovered(index);
      });
    };
    const down = event => { press.current = [event.clientX, event.clientY]; };
    const up = event => {
      const start = press.current; press.current = null;
      if (!start || Math.hypot(event.clientX - start[0], event.clientY - start[1]) > 5) return;
      const index = nearest(event);
      if (index !== null) onSelect(index);
    };
    const leave = () => { refresh.current = null; element.style.cursor = ''; setHovered(null); };
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerdown', down);
    element.addEventListener('pointerup', up);
    element.addEventListener('pointerleave', leave);
    return () => {
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerdown', down);
      element.removeEventListener('pointerup', up);
      element.removeEventListener('pointerleave', leave);
      element.style.cursor = '';
      refresh.current = null;
    };
  }, [gl, camera, visible, onSelect]);
  const hoveredList = hovered !== null ? matches.get(hovered) : null;
  const info = hoveredList ? describeSystem(data, hovered, hoveredList) : null;

  return <group>
    <points key={visible.indices.length} frustumCulled={false} renderOrder={5}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[visible.position, 3]} />
        <bufferAttribute attach="attributes-tint" args={[visible.tint, 3]} />
        <bufferAttribute attach="attributes-size" args={[visible.sizes, 1]} />
        <bufferAttribute attach="attributes-candidate" args={[visible.candidate, 1]} />
        <bufferAttribute attach="attributes-phase" args={[visible.phase, 1]} />
      </bufferGeometry>
      <shaderMaterial ref={material} uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader}
        transparent depthWrite={false} depthTest={false} blending={THREE.NormalBlending} toneMapped={false} />
    </points>
    <Html position={origin.map(v => -v)} zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
      <div ref={sunLabel} className="descubrimientos-sol"><i />Sol</div>
    </Html>
    {info && <Html position={[0, 1, 2].map(axis => data.systems.p[hovered * 3 + axis] - origin[axis])} zIndexRange={[8, 0]} style={{ pointerEvents: 'none' }}>
      <div className="descubrimiento-ficha">
        <span className="descubrimiento-mira" aria-hidden="true" />
        <strong>{info.name}</strong>
        <span>{lightYears(info.distancePc / LIGHT_YEAR_PC)} años luz del Sol</span>
        <span>{[info.confirmed && `${info.confirmed} ${info.confirmed === 1 ? 'planeta confirmado' : 'planetas confirmados'}`,
          info.candidates && `${info.candidates} ${info.candidates === 1 ? 'candidato' : 'candidatos'}`].filter(Boolean).join(' · ')}</span>
        <span className="descubrimiento-tipos">{info.types.map(type => <em key={type.id}><i style={{ background: type.color }} />{type.n} {type.nombre.toLowerCase()}</em>)}</span>
        <span>{info.missions.length === 1 ? info.missions[0] : `${info.missions.slice(0, 2).join(', ')}${info.missions.length > 2 ? '…' : ''}`}</span>
        <span className="descubrimiento-accion">{info.inHoshi ? 'Clic: viajar al sistema' : 'Posición del archivo de la NASA · sin estrella en Hoshi'}</span>
      </div>
    </Html>}
  </group>;
}
