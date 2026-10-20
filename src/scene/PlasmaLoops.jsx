import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Grosor de cada hebra en radios estelares (≈ 4 Mm en el Sol).
const STRAND_RADIUS = 0.006;

const vertexShader = `
  attribute float phase;
  varying vec2 along;
  varying float strandPhase;
  varying vec3 objectPoint;
  varying vec3 cameraPoint;
  varying vec3 eyeNormal;
  varying vec3 eyeDirection;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    along = uv;
    strandPhase = phase;
    objectPoint = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    mat3 linear = mat3(modelViewMatrix);
    cameraPoint = -(transpose(linear) * modelViewMatrix[3].xyz) / dot(linear[0], linear[0]);
    eyeNormal = normalize(normalMatrix * normal);
    eyeDirection = -mv.xyz;
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`;
const fragmentShader = `
  uniform float time;
  uniform float glare;
  uniform float halpha;
  uniform float euv;
  uniform vec3 temperatureTint;
  varying vec2 along;
  varying float strandPhase;
  varying vec3 objectPoint;
  varying vec3 cameraPoint;
  varying vec3 eyeNormal;
  varying vec3 eyeDirection;
  #include <logdepthbuf_pars_fragment>
  void main() {
    // Plasma que recorre el arco de un pie al otro, guiado por el campo magnético.
    float u = along.x;
    float flow = 0.62 + 0.25 * sin(u * 16.0 - time * 0.9 + strandPhase)
      + 0.13 * sin(u * 41.0 - time * 1.7 + strandPhase * 3.0);
    float feet = smoothstep(0.0, 0.05, u) * smoothstep(1.0, 0.95, u);
    // Más densa en el eje de la hebra y difusa en el borde.
    float core = pow(abs(dot(normalize(eyeNormal), normalize(eyeDirection))), 1.6);
    // ¿Detrás de este punto está el disco o el cielo?
    vec3 ray = normalize(objectPoint - cameraPoint);
    float b = dot(cameraPoint, ray);
    float onDisk = step(0.0, b * b - dot(cameraPoint, cameraPoint) + 1.0);
    vec3 hue = temperatureTint / max(max(temperatureTint.r, temperatureTint.g), temperatureTint.b);
    vec3 gold = mix(vec3(1.0, 0.55, 0.12), vec3(1.0, 0.92, 0.65), flow * core) * mix(vec3(1.0), hue * hue, 0.5);
    // Cromosfera (304 Å): el plasma frío absorbe sobre el disco (filamento oscuro) y brilla fuera de él
    // (protuberancia). Ultravioleta: el arco caliente emite en todas partes.
    vec3 red = mix(vec3(1.0, 0.3, 0.06), vec3(1.0, 0.8, 0.5), flow * core);
    vec3 alphaColour = mix(red, vec3(0.1, 0.0, 0.0), onDisk);
    float alphaOpacity = feet * core * mix(flow, 0.8, onDisk);
    vec3 uvColour = mix(gold, vec3(1.0), 0.35 * flow);
    float uvOpacity = core * (0.35 + 0.65 * flow);
    float opacity = (halpha * alphaOpacity + euv * uvOpacity) * (1.0 - glare);
    if (opacity < 0.003) discard;
    gl_FragColor = vec4(mix(alphaColour, uvColour, euv / max(halpha + euv, 0.001)), min(1.0, opacity));
    #include <logdepthbuf_fragment>
    #include <colorspace_fragment>
  }
`;

// Arco entre dos pies sobre la superficie unitaria, elevado e inclinado.
function strandGeometry(direction, loop, lift) {
  const centre = new THREE.Vector3(...direction);
  const reference = Math.abs(centre.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const east = new THREE.Vector3().crossVectors(reference, centre).normalize();
  const north = new THREE.Vector3().crossVectors(centre, east);
  const axis = east.clone().multiplyScalar(Math.cos(loop.azimuth)).addScaledVector(north, Math.sin(loop.azimuth));
  const side = new THREE.Vector3().crossVectors(centre, axis);
  const rise = centre.clone().multiplyScalar(Math.cos(loop.tilt)).addScaledVector(side, Math.sin(loop.tilt));
  const points = Array.from({ length: 25 }, (_, i) => {
    const t = i / 24;
    // Hebras concéntricas: las interiores son más cortas y bajas, como en una arcada real.
    return centre.clone().addScaledVector(axis, (t - 0.5) * loop.separation * (0.5 + 0.5 * lift))
      .addScaledVector(side, (lift - 0.76) * 0.12 * loop.separation).normalize()
      .addScaledVector(rise, loop.height * lift * Math.sin(Math.PI * t) ** 0.75);
  });
  const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 48, STRAND_RADIUS, 6, false);
  const phase = new Float32Array(geometry.attributes.position.count).fill(loop.phase + lift * 5);
  geometry.setAttribute('phase', new THREE.BufferAttribute(phase, 1));
  return geometry;
}

// Arcos de plasma anclados a las regiones activas: geometría real, igual desde cualquier
// ángulo. Cada arco tiene varias hebras anidadas, como una arcada.
export default function PlasmaLoops({ regions, tint, view }) {
  const geometry = useMemo(() => {
    const strands = regions.flatMap(region => region.loops.flatMap(loop =>
      [1, 0.88, 0.76, 0.64, 0.52].map(lift => strandGeometry(region.direction, loop, lift))));
    const merged = strands.length ? mergeGeometries(strands) : null;
    strands.forEach(strand => strand.dispose());
    return merged;
  }, [regions]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  const own = useMemo(() => ({ time: { value: 0 }, glare: { value: 1 }, halpha: { value: 0 }, euv: { value: 0 },
    temperatureTint: { value: tint } }), [tint]);
  const material = useRef();
  useFrame(() => {
    if (!material.current) return;
    ['time', 'glare', 'halpha', 'euv'].forEach(name => { material.current.uniforms[name].value = view.current[name]; });
    // Sobre el mapa real de la cromosfera no se dibujan arcos inventados.
    if (view.current.real) material.current.uniforms.halpha.value = 0;
  });
  if (!geometry) return null;
  return <mesh geometry={geometry} raycast={() => null} renderOrder={2}>
    <shaderMaterial ref={material} uniforms={own} vertexShader={vertexShader} fragmentShader={fragmentShader}
      transparent depthWrite={false} toneMapped={false} />
  </mesh>;
}
