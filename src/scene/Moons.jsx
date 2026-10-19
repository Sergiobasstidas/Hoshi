import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, Matrix4, Quaternion, SRGBColorSpace, Vector3 } from 'three';
import { KM_TO_PC, PLANETS, smoothRange } from './scale';
import { EPHEMERIS_DATE, planetPosition } from './solarEphemeris';
import { julianDay, moonOffsetKm, orbitalPeriodDays } from './moonEphemeris';
import { sampleTrail } from './fadingTrail';
import FadingTrails from './FadingTrails';
import { MOON_PLANETS, hiddenByPlanet, useMoons } from './moonBodies';

// Lunas de Júpiter y Saturno: esferas a escala de su radio, en su posición de la fecha y con
// una estela de casi toda su última vuelta (FadingTrails.jsx). De lejos, un punto de tamaño fijo (no representa el radio) indica dónde
// está cada una hasta que la esfera ocupa unos píxeles. Color ilustrativo; iluminación desde
// el Sol (la luz puntual de SolarSystem.jsx), sin sombras del planeta. Los nombres se colocan
// sobre los botones de [data-moon-labels] (MoonLabels.jsx), con descarte de solapes.
// Radio aparente de la órbita, en píxeles, entre los que aparece el punto de cada luna.
const MARKER_PIXELS = [6, 22];
// El punto se retira cuando la esfera ya ocupa estos píxeles de radio.
const SPHERE_PIXELS = [1.5, 4];
// Nombres: las lunas grandes aparecen antes; las pequeñas, solo con su órbita muy abierta.
const MAJOR_LABEL_PIXELS = [30, 70], MINOR_LABEL_PIXELS = [260, 520];
const MAJOR_RADIUS_KM = 40, MAX_LABELS = 20;
// Las lunas que ya se ven como esfera salen de la malla instanciada y se dibujan sueltas: la
// matriz de cada instancia se guarda en float32 relativa al planeta y, a 20 millones de km, eso
// deja un error de ≈ 1 km, mayor que una luna pequeña (se veía como un polígono roto). Una malla
// suelta recibe su posición respecto de la cámara calculada en doble precisión.
const NEAR_POOL = 6, NEAR_PIXELS = 0.5;
const hidden = new Matrix4().makeScale(0, 0, 0);

// Estela: la trayectoria real del último 90 % de la vuelta (como la Luna, pedido de Sergio del
// 19/10/2026; antes media vuelta), de transparente a opaca hasta la luna.
const TRAIL_SPAN = 0.9, TRAIL_POINTS = 140;
// Color (el beige de NASA Eyes, pedido por Sergio) y desvanecimiento son estilo; las pequeñas, más tenues.
const TRAIL_FADE = [12, 50], TRAIL_COLOR = new Color('#d9c59a'), MINOR_TRAIL_COLOR = new Color('#a8987a');
const vector = new Vector3(), view = new Vector3();

function MoonGroup({ planet, moons, origin }) {
  const group = useRef(), spheres = useRef(), points = useRef(), material = useRef(), pool = useRef([]);
  const nearState = useRef([]);
  const center = useMemo(() => planetPosition(planet), [planet]);
  const planetRadiusPc = useMemo(() => PLANETS.find(item => item.name === planet).radiusKm * KM_TO_PC, [planet]);
  const attributes = useMemo(() => ({
    position: new Float32Array(moons.flatMap(body => body.offsetPc)),
    color: new Float32Array(moons.flatMap(body => new Color().setStyle(body.color, SRGBColorSpace).toArray())),
    size: new Float32Array(moons.map(body => body.radiusKm >= MAJOR_RADIUS_KM ? 6 : 3.5)),
    alpha: new Float32Array(moons.length),
  }), [moons]);
  // Distancia al planeta y radio en pc, para no recalcularlos en cada cuadro.
  const metrics = useMemo(() => moons.map(body => ({ orbitPc: Math.hypot(...body.offsetPc), radiusPc: body.radiusKm * KM_TO_PC,
    major: body.radiusKm >= MAJOR_RADIUS_KM })), [moons]);
  const outermostPc = useMemo(() => Math.max(...metrics.map(item => item.orbitPc)), [metrics]);
  const uniforms = useMemo(() => ({ pixelRatio: { value: 1 } }), []);
  const trails = useMemo(() => {
    const endJd = julianDay(EPHEMERIS_DATE);
    return moons.map((body, i) => ({
      points: sampleTrail(jd => moonOffsetKm(body.moon, jd).map(value => value * KM_TO_PC), endJd, orbitalPeriodDays(body.moon, EPHEMERIS_DATE) * TRAIL_SPAN, TRAIL_POINTS),
      color: (metrics[i].major ? TRAIL_COLOR : MINOR_TRAIL_COLOR).toArray(), weight: metrics[i].major ? 1 : 0.3, size: metrics[i].orbitPc,
      // Las pequeñas se retiran vistas desde muy dentro de su órbita: cruzaban la pantalla como rectas.
      ...(!metrics[i].major && { fadeOutPixels: 1200 }),
    }));
  }, [moons, metrics]);
  // Los primeros cuadros se dibuja todo aunque esté lejos: así los sombreadores se compilan y los
  // datos suben a la GPU durante la carga y no al llegar al planeta (eso trababa la llegada).
  const warmup = useRef(3);
  const labelState = useRef({ elements: null, shown: new Set() });

  useLayoutEffect(() => {
    const matrix = new Matrix4(), rotation = new Quaternion(), scale = new Vector3(), position = new Vector3();
    moons.forEach((body, i) => {
      matrix.compose(position.fromArray(body.offsetPc), rotation, scale.setScalar(body.radiusKm * KM_TO_PC));
      spheres.current.setMatrixAt(i, matrix);
      spheres.current.setColorAt(i, new Color().setStyle(body.color, SRGBColorSpace));
    });
    spheres.current.instanceMatrix.needsUpdate = true;
    spheres.current.instanceColor.needsUpdate = true;
    spheres.current.computeBoundingSphere();
    labelState.current.elements = null;
    nearState.current = [];
  }, [moons]);

  // Reparte las esferas visibles entre la malla instanciada y las mallas sueltas.
  const assignNear = near => {
    const previous = nearState.current;
    if (near.length === previous.length && near.every((index, k) => index === previous[k])) return;
    const matrix = new Matrix4(), rotation = new Quaternion(), scale = new Vector3(), position = new Vector3();
    for (const index of previous) if (!near.includes(index)) {
      const body = moons[index];
      spheres.current.setMatrixAt(index, matrix.compose(position.fromArray(body.offsetPc), rotation, scale.setScalar(body.radiusKm * KM_TO_PC)));
    }
    for (const index of near) spheres.current.setMatrixAt(index, hidden);
    spheres.current.instanceMatrix.needsUpdate = true;
    pool.current.forEach((mesh, k) => {
      const body = moons[near[k]];
      mesh.visible = Boolean(body);
      if (!body) return;
      mesh.position.fromArray(body.offsetPc);
      mesh.scale.setScalar(body.radiusKm * KM_TO_PC);
      mesh.material.color.setStyle(body.color, SRGBColorSpace);
    });
    nearState.current = near;
  };

  useFrame(({ camera, gl, size }) => {
    const focal = size.height / (2 * Math.tan(camera.fov * Math.PI / 360));
    const cx = camera.position.x + origin[0] - center[0], cy = camera.position.y + origin[1] - center[1], cz = camera.position.z + origin[2] - center[2];
    const planetDistance = Math.hypot(cx, cy, cz);
    const container = document.querySelector('[data-moon-labels]');
    const state = labelState.current;
    if (container && (!state.elements || state.elements.size !== container.children.length)) {
      state.elements = new Map([...container.children].map(element => [element.dataset.code, element]));
    }
    const hideLabels = () => {
      for (const code of state.shown) { const element = state.elements?.get(code); if (element) { element.style.opacity = 0; element.style.visibility = 'hidden'; } }
      state.shown.clear();
    };
    // Lejos del planeta no hay nada que dibujar: ni puntos ni nombres.
    const active = outermostPc / planetDistance * focal > MARKER_PIXELS[0];
    group.current.visible = active || warmup.current-- > 0;
    if (!active) { hideLabels(); assignNear([]); return; }
    const near = [];
    const focused = container?.dataset.focused || '';
    const candidates = [];
    camera.updateMatrixWorld();
    moons.forEach((body, i) => {
      const { orbitPc, radiusPc, major } = metrics[i];
      const dx = cx - body.offsetPc[0], dy = cy - body.offsetPc[1], dz = cz - body.offsetPc[2];
      const distance = Math.hypot(dx, dy, dz);
      const orbitPixels = orbitPc / planetDistance * focal;
      const spherePixels = radiusPc / distance * focal;
      if (spherePixels > NEAR_PIXELS) near.push([i, spherePixels]);
      attributes.alpha[i] = smoothRange(orbitPixels, ...MARKER_PIXELS) * (1 - smoothRange(spherePixels, ...SPHERE_PIXELS)) * (major ? 1 : 0.7);
      const isFocused = String(body.moon.code) === focused;
      const labelAlpha = isFocused ? 1 : smoothRange(orbitPixels, ...(major ? MAJOR_LABEL_PIXELS : MINOR_LABEL_PIXELS))
        * Math.max(attributes.alpha[i], smoothRange(spherePixels, ...SPHERE_PIXELS));
      if (labelAlpha < 0.02 || !container || hiddenByPlanet(cx, cy, cz, body.offsetPc, planetRadiusPc)) return;
      view.set(center[0] - origin[0] + body.offsetPc[0], center[1] - origin[1] + body.offsetPc[1], center[2] - origin[2] + body.offsetPc[2]);
      vector.copy(view).applyMatrix4(camera.matrixWorldInverse);
      if (-vector.z <= camera.near) return;
      vector.applyMatrix4(camera.projectionMatrix);
      if (Math.abs(vector.x) > 0.97 || Math.abs(vector.y) > 0.93) return;
      const screenX = (vector.x + 1) * size.width / 2, screenY = (1 - vector.y) * size.height / 2;
      const item = { code: String(body.moon.code), alpha: labelAlpha, priority: isFocused ? Infinity : body.radiusKm,
        x: screenX + Math.min(spherePixels, size.width / 3) + 8, y: screenY - 8, width: body.name.length * 6.2 + 8 };
      candidates.push(item);
    });
    assignNear(near.sort((a, b) => b[1] - a[1]).slice(0, NEAR_POOL).map(([index]) => index).sort((a, b) => a - b));
    points.current.geometry.attributes.alpha.needsUpdate = true;
    material.current.uniforms.pixelRatio.value = gl.getPixelRatio();
    if (!container) return;
    // Sin solapes: primero la luna enfocada y después las de mayor radio.
    candidates.sort((a, b) => b.priority - a.priority);
    const placed = [], next = new Set();
    for (const item of candidates) {
      if (placed.length >= MAX_LABELS) break;
      if (placed.some(other => item.x < other.x + other.width && other.x < item.x + item.width && Math.abs(item.y - other.y) < 14)) continue;
      placed.push(item);
      const element = state.elements.get(item.code);
      if (!element) continue;
      // Escribir en el DOM solo lo que cambia: con decenas de nombres por cuadro se nota.
      const opacity = item.alpha.toFixed(2), transform = `translate(${Math.round(item.x)}px, ${Math.round(item.y)}px)`;
      if (element.style.opacity !== opacity) element.style.opacity = opacity;
      if (element.style.visibility !== 'visible') element.style.visibility = 'visible';
      if (element.style.transform !== transform) element.style.transform = transform;
      next.add(item.code);
    }
    for (const code of state.shown) if (!next.has(code)) { const element = state.elements.get(code); if (element) { element.style.opacity = 0; element.style.visibility = 'hidden'; } }
    state.shown = next;
  });

  return <group ref={group} position={center}>
    <instancedMesh ref={spheres} args={[null, null, moons.length]}>
      <sphereGeometry args={[1, 32, 24]} />
      <meshLambertMaterial toneMapped={false} />
    </instancedMesh>
    {Array.from({ length: NEAR_POOL }, (_, k) => <mesh key={k} ref={mesh => { pool.current[k] = mesh; }} visible={false}>
      <sphereGeometry args={[1, 48, 32]} />
      <meshLambertMaterial toneMapped={false} />
    </mesh>)}
    <FadingTrails trails={trails} fadePixels={TRAIL_FADE} opacity={1} width={1.6} />
    <points ref={points} frustumCulled={false}>
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
    </points>
  </group>;
}

export default function Moons({ origin }) {
  const { bodies } = useMoons();
  const groups = useMemo(() => MOON_PLANETS.map(planet => ({ planet, moons: bodies.filter(body => body.planet === planet) }))
    .filter(group => group.moons.length > 0), [bodies]);
  return groups.map(group => <MoonGroup key={group.planet} planet={group.planet} moons={group.moons} origin={origin} />);
}
