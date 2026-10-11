import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AU_TO_PC, LIGHT_YEAR_PC, SUN_RADIUS_PC, backgroundGain, starExposure, smoothRange } from './scale';
import { STAR_STOP_PC } from './starHeading';
import { buildStellarAppearance, catalogueColor } from './stellarAppearance';
import { catalogueGalaxyGain } from './galaxy.js';
import StellarSurface from './StellarSurface';

const vertexShader = `
  attribute vec3 starColor;
  attribute float luminosity;
  attribute float individualLuminosity;
  attribute float markerSize;
  attribute vec3 vividColor;
  uniform float named;
  uniform float exposure;
  uniform float pixelRatio;
  uniform float distantSize;
  uniform float farCompression;
  uniform float individualMix;
  uniform float inspect;
  uniform float physicalRadius;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vHalo;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float distanceToEye = max(length(mvPosition.xyz), 0.001);
    float nearSize = 1.0 / sqrt(distanceToEye + 0.5);
    float backgroundSize = clamp(2.8 + 2.5 * nearSize, 2.8, 5.5);
    float namedSize = clamp(25.0 + 15.0 * nearSize, 25.0, 40.0);
    // Resolve progressively smaller distant sources instead of stacking
    // hundreds of fixed-size named halos into a white disc.
    float farView = smoothstep(300.0, 3000.0, distanceToEye) * farCompression;
    float sizeReduction = mix(mix(1.0, 0.65, farView), mix(1.0, 0.5, farView), named);
    float individualSize = mix(1.0, markerSize, individualMix);
    float inspectionSize = inspect * (physicalRadius > 0.0 ? 0.0 : 90.0) * (1.0 - smoothstep(${STAR_STOP_PC}, ${5000 * AU_TO_PC}, length(mvPosition.xyz)));
    gl_PointSize = (1.15 * mix(backgroundSize, namedSize, named) * distantSize * sizeReduction * individualSize + inspectionSize) * pixelRatio;
    vColor = mix(starColor, vividColor, individualMix);
    vAlpha = exposure * mix(luminosity, individualLuminosity, individualMix)
      * mix(0.36, mix(1.0, 0.65, farView), named);
    // Dense, unresolved background points also need an energy reduction:
    // shrinking below a pixel alone leaves their central sample too bright.
    vAlpha *= mix(mix(1.0, 0.25, farView), 1.0, named);
    // Fade the location marker as the true stellar disc resolves. Never draw
    // a large point on top of a textured photosphere.
    if (physicalRadius > 0.0) {
      vAlpha *= smoothstep(20.0, 100.0, length(mvPosition.xyz) / physicalRadius);
    }
    vHalo = mix(1.0, 0.2, farView);
    gl_Position = projectionMatrix * mvPosition;
    #include <logdepthbuf_vertex>
  }
`;
const fragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vHalo;
  uniform float named;
  uniform float individualMix;
  #include <logdepthbuf_pars_fragment>
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(p, p);
    // Continuous Gaussians: no solid disc, rings or diffraction crosses.
    float core = exp(-r2 * mix(6.0, 65.0, named));
    float halo = exp(-r2 * 12.0) * 0.35 * named * vHalo;
    float edge = 1.0 - smoothstep(0.65, 1.0, r2);
    float whitening = mix(mix(0.18, 0.88, named), mix(0.02, 0.12, named), individualMix);
    vec3 color = mix(vColor, vec3(1.0), core * whitening);
    gl_FragColor = vec4(color, (core + halo) * edge * vAlpha);
    #include <logdepthbuf_fragment>
  }
`;

function StarGroup({ stars, named, origin, anchor, physicalRadius = 0, solar = false, gain = 1 }) {
  const materialRef = useRef();
  const attributes = useMemo(() => {
    const position = new Float32Array(stars.length * 3);
    const color = new Float32Array(stars.length * 3);
    stars.forEach((star, i) => {
      // Subtract in CPU double precision before uploading to Float32 GPU buffers.
      position.set(anchor ? [0, 0, 0] : [star.x - origin[0], star.y - origin[1], star.z - origin[2]], i * 3);
      color.set(catalogueColor(star.rgb), i * 3);
    });
    return { position, color, ...buildStellarAppearance(stars) };
  }, [stars, origin, anchor]);
  const uniforms = useMemo(() => ({ named: { value: named ? 1 : 0 },
    exposure: { value: 0.13 }, pixelRatio: { value: 1 }, distantSize: { value: 1 },
    farCompression: { value: 0 }, individualMix: { value: 0 }, inspect: { value: anchor ? 1 : 0 },
    physicalRadius: { value: physicalRadius } }), [named, anchor, physicalRadius]);
  useFrame(({ camera, gl }) => {
    const distance = Math.hypot(camera.position.x + origin[0], camera.position.y + origin[1], camera.position.z + origin[2]);
    materialRef.current.uniforms.exposure.value = starExposure(distance) * (named ? 1 : backgroundGain(distance)) * gain * (anchor ? 1 : catalogueGalaxyGain(distance));
    if (solar) materialRef.current.uniforms.exposure.value *= smoothRange(distance, 0.015 * LIGHT_YEAR_PC, 0.02 * LIGHT_YEAR_PC);
    materialRef.current.uniforms.pixelRatio.value = gl.getPixelRatio();
    materialRef.current.uniforms.individualMix.value = smoothRange(distance, 4, 12);
    materialRef.current.uniforms.farCompression.value = THREE.MathUtils.smoothstep(distance, 300, 3000);
    materialRef.current.uniforms.distantSize.value = 1 - 0.22
      * THREE.MathUtils.smoothstep(distance, 50, 300);
  });
  return (
    <points frustumCulled={false} position={anchor}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[attributes.position, 3]} />
        <bufferAttribute attach="attributes-starColor" args={[attributes.color, 3]} />
        <bufferAttribute attach="attributes-luminosity" args={[attributes.luminosity, 1]} />
        <bufferAttribute attach="attributes-individualLuminosity" args={[attributes.individualLuminosity, 1]} />
        <bufferAttribute attach="attributes-markerSize" args={[attributes.markerSize, 1]} />
        <bufferAttribute attach="attributes-vividColor" args={[attributes.vividColor, 3]} />
      </bufferGeometry>
      <shaderMaterial ref={materialRef} uniforms={uniforms} vertexShader={vertexShader}
        fragmentShader={fragmentShader} transparent depthWrite={false} depthTest
        blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  );
}

export default function StarField({ stars, origin, focusedStar, departureStar, gain = 1 }) {
  const groups = useMemo(() => ({
    solar: stars.filter(s => s.n === 'Sol' || s.n === 'Sun').map(s => ({...s,x:0,y:0,z:0})),
    named: stars.filter(s => s.n && s.n !== 'Sol' && s.n !== 'Sun'),
    background: stars.filter(s => !s.n),
  }), [stars]);
  const retained = departureStar?.i !== focusedStar?.i ? departureStar : null;
  const visibleNamed = useMemo(() => groups.named.filter(s => s.i !== focusedStar?.i && s.i !== retained?.i), [groups, focusedStar, retained]);
  const visibleBackground = useMemo(() => groups.background.filter(s => s.i !== focusedStar?.i && s.i !== retained?.i), [groups, focusedStar, retained]);
  const focused = useMemo(() => focusedStar ? [focusedStar] : [], [focusedStar]);
  const departing = useMemo(() => retained ? [retained] : [], [retained]);
  const departureAnchor = useMemo(() => retained
    ? [retained.x-origin[0], retained.y-origin[1], retained.z-origin[2]] : null, [retained,origin]);
  // Object translation is subtracted from the camera in CPU double precision.
  // A zero-centred point avoids losing an AU-scale arrival in catalogue Float32 coordinates.
  const anchor = useMemo(() => focusedStar
    ? [focusedStar.x - origin[0], focusedStar.y - origin[1], focusedStar.z - origin[2]] : null, [focusedStar, origin]);
  return <><StarGroup gain={gain} stars={visibleBackground} named={false} origin={origin} />
    <StarGroup gain={gain} stars={visibleNamed} named origin={origin} />
    <StarGroup gain={gain} stars={groups.solar} named solar origin={origin} physicalRadius={SUN_RADIUS_PC} />
    {focusedStar && <StarGroup gain={gain} stars={focused} named origin={origin} anchor={anchor} physicalRadius={focusedStar.physics?.radiusPc} />}
    {focusedStar?.physics && <StellarSurface position={anchor} radiusPc={focusedStar.physics.radiusPc}
      temperatureK={focusedStar.physics.temperatureK} />}
    {retained && <StarGroup gain={gain} stars={departing} named origin={origin} anchor={departureAnchor} physicalRadius={retained.physics?.radiusPc} />}
    {retained?.physics && <StellarSurface position={departureAnchor} radiusPc={retained.physics.radiusPc} temperatureK={retained.physics.temperatureK} />}
  </>;
}
