import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, Color, LinearMipmapLinearFilter, Matrix4, Quaternion, SRGBColorSpace, TextureLoader, Vector3 } from 'three';
import { AU_TO_PC, KM_TO_PC, PLANETS, smoothRange } from './scale';
import { EPHEMERIS_DATE, planetPosition } from './solarEphemeris';
import { julianDay, moonOffsetKm, orbitalPeriodDays } from './moonEphemeris';
import { sampleTrail } from './fadingTrail';
import FadingTrails from './FadingTrails';
import { MOON_PLANETS, hiddenByPlanet, publicarPresencia, useMoons } from './moonBodies';
import { currentOccluders, hiddenBehind, publishOccluders } from './labelOcclusion';
import { moonAxes, moonTextureUrl } from './moonTextures';

// Lunas de Júpiter y Saturno: esferas a escala de su radio, en su posición de la fecha y con
// una estela de un cuarto de vuelta (FadingTrails.jsx). De lejos, un punto de tamaño fijo (no representa el radio) indica dónde
// está cada una hasta que la esfera ocupa unos píxeles. Color ilustrativo; iluminación desde
// el Sol (la luz puntual de SolarSystem.jsx), sin sombras del planeta. Los nombres se colocan
// sobre los botones de [data-moon-labels] (MoonLabels.jsx), con descarte de solapes.
// Radio aparente de la órbita, en píxeles, entre los que aparece el punto de cada luna.
const MARKER_PIXELS = [6, 22];
// El punto se retira cuando la esfera ya ocupa estos píxeles de radio.
const SPHERE_PIXELS = [1.5, 4];
// Nombres (pedido de Sergio, 08/11/2026): las lunas de radio ≥ LABEL_RADIUS_KM llevan nombre fijo, que aparece
// al entrar al sistema (la órbita de la más externa de ellas ocupa PRESENCE_PIXELS de radio) y se queda.
// Las pequeñas conservan su punto; su nombre aparece al pasar el ratón a menos de HOVER_PIXELS de su punto
// o esfera, si es la luna enfocada, o de cerca, cuando su esfera ocupa SMALL_SPHERE_PIXELS de radio.
const LABEL_RADIUS_KM = 150, PRESENCE_PIXELS = [15, 30], HOVER_PIXELS = 12, SMALL_SPHERE_PIXELS = [3, 5];
const MAJOR_RADIUS_KM = 40, MAX_LABELS = 20;
// Espacio libre (px) que necesita un nombre nuevo para aparecer junto a los que ya están.
const LABEL_MARGIN = 6;
// Rapidez (1/s) del fundido de los nombres al aparecer y desaparecer.
const LABEL_FADE = 12;
// Las lunas que ya se ven como esfera salen de la malla instanciada y se dibujan sueltas: la
// matriz de cada instancia se guarda en float32 relativa al planeta y, a 20 millones de km, eso
// deja un error de ≈ 1 km, mayor que una luna pequeña (se veía como un polígono roto). Una malla
// suelta recibe su posición respecto de la cámara calculada en doble precisión.
const NEAR_POOL = 6, NEAR_PIXELS = 0.5;
const hidden = new Matrix4().makeScale(0, 0, 0);

// Estela: la trayectoria real del último cuarto de vuelta, de transparente a opaca hasta la luna.
// Se acortó el 01/11/2026 para que no se confunda con los anillos.
const TRAIL_SPAN = 0.25, TRAIL_POINTS = 240;
// Color (el beige de NASA Eyes, pedido por Sergio) y desvanecimiento son estilo; las pequeñas, más tenues.
const TRAIL_FADE = [12, 50], TRAIL_COLOR = new Color('#d9c59a'), MINOR_TRAIL_COLOR = new Color('#a8987a');
// Las órbitas no se ven de lejos (pedido de Sergio, 31/10/2026): aparecen de forma gradual al
// acercarse al planeta, desde 2,5 UA de la cámara, y están completas a 1 UA.
const TRAIL_DISTANCE = [2.5 * AU_TO_PC, 1 * AU_TO_PC];
const vector = new Vector3(), view = new Vector3();

// Mapas de superficie (moonTextures.js): se cargan cuando la esfera de la luna pasa TEXTURE_PIXELS de radio
// y quedan en caché. Son mapas en gris: se tiñen con el color de la luna aclarado a la mitad.
const TEXTURE_PIXELS = 20;
const textureCache = new Map(), loader = new TextureLoader();
function moonTexture(url, onReady) {
  let entry = textureCache.get(url);
  if (!entry) {
    entry = { texture: null };
    textureCache.set(url, entry);
    loader.load(url, texture => {
      texture.colorSpace = SRGBColorSpace;
      texture.minFilter = LinearMipmapLinearFilter;
      texture.anisotropy = 4;
      entry.texture = texture;
      onReady();
    });
  }
  return entry.texture;
}
// Orientación de cada luna con mapa en la fecha de carga (polo y meridiano cero de la IAU).
const orientationCache = new Map();
function moonQuaternion(code) {
  if (!orientationCache.has(code)) {
    const { x, y, z } = moonAxes(code, EPHEMERIS_DATE);
    orientationCache.set(code, new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(
      new Vector3(...x), new Vector3(...y), new Vector3(...z))));
  }
  return orientationCache.get(code);
}
const WHITE = new Color('white');
// El puntero de R3F arranca en el centro de la pantalla y se queda donde fue el último movimiento, aunque
// el ratón esté sobre un nombre o un botón: justo donde queda el planeta al viajar a él, y todas sus lunas
// chicas contaban como «bajo el ratón». Solo cuenta si el ratón se movió sobre el lienzo mismo.
const pointerOnCanvas = { value: false };

function MoonGroup({ planet, moons, origin }) {
  const canvas = useThree(state => state.gl.domElement);
  useEffect(() => {
    const move = event => { pointerOnCanvas.value = event.target === canvas; };
    const leave = () => { pointerOnCanvas.value = false; };
    window.addEventListener('pointermove', move);
    document.addEventListener('pointerleave', leave);
    return () => { window.removeEventListener('pointermove', move); document.removeEventListener('pointerleave', leave); };
  }, [canvas]);
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
  // Órbita de la luna con nombre fijo más externa: mide la presencia del sistema en pantalla.
  const namedOrbitPc = useMemo(() => Math.max(0, ...moons.map((body, i) => body.radiusKm >= LABEL_RADIUS_KM ? metrics[i].orbitPc : 0)),
    [moons, metrics]);
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
  const labelState = useRef({ elements: null, shown: new Set(), fading: new Map() });

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
      mesh.material.map = null;
      mesh.material.needsUpdate = true;
      mesh.userData.textured = false;
      if (moonTextureUrl(body.moon.code)) mesh.quaternion.copy(moonQuaternion(body.moon.code));
      else mesh.quaternion.identity();
    });
    nearState.current = near;
  };

  useFrame(({ camera, gl, size, pointer, invalidate }, delta) => {
    const focal = size.height / (2 * Math.tan(camera.fov * Math.PI / 360));
    const cx = camera.position.x + origin[0] - center[0], cy = camera.position.y + origin[1] - center[1], cz = camera.position.z + origin[2] - center[2];
    const planetDistance = Math.hypot(cx, cy, cz);
    const presence = smoothRange(namedOrbitPc / planetDistance * focal, ...PRESENCE_PIXELS);
    publicarPresencia(planet, presence);
    const pointerX = (pointer.x + 1) * size.width / 2, pointerY = (1 - pointer.y) * size.height / 2;
    const container = document.querySelector('[data-moon-labels]');
    const state = labelState.current;
    if (container && (!state.elements || state.elements.size !== container.children.length)) {
      state.elements = new Map([...container.children].map(element => [element.dataset.code, element]));
    }
    const hideLabels = () => {
      for (const code of state.fading.keys()) { const element = state.elements?.get(code); if (element) { element.style.opacity = 0; element.style.visibility = 'hidden'; } }
      state.shown.clear();
      state.fading.clear();
    };
    // Lejos del planeta no hay nada que dibujar: ni puntos ni nombres.
    const active = outermostPc / planetDistance * focal > MARKER_PIXELS[0];
    group.current.visible = active || warmup.current-- > 0;
    if (!active) { hideLabels(); assignNear([]); publishOccluders(`lunas-${planet}`, []); return; }
    const near = [];
    const focused = container?.dataset.focused || '';
    const candidates = [];
    camera.updateMatrixWorld();
    // Los nombres tapados por un cuerpo más cercano (planeta, Sol u otra luna) no se muestran.
    const occluders = currentOccluders(camera, size), moonDisks = [];
    moons.forEach((body, i) => {
      const { orbitPc, radiusPc, major } = metrics[i];
      const dx = cx - body.offsetPc[0], dy = cy - body.offsetPc[1], dz = cz - body.offsetPc[2];
      const distance = Math.hypot(dx, dy, dz);
      const orbitPixels = orbitPc / planetDistance * focal;
      const spherePixels = radiusPc / distance * focal;
      if (spherePixels > NEAR_PIXELS) near.push([i, spherePixels]);
      // Toda luna que ya se ve como esfera tapa nombres, rutas y clics detrás de ella (labelOcclusion.js),
      // tenga o no su nombre a la vista.
      if (spherePixels > 3) {
        view.set(center[0] - origin[0] + body.offsetPc[0], center[1] - origin[1] + body.offsetPc[1], center[2] - origin[2] + body.offsetPc[2]);
        vector.copy(view).applyMatrix4(camera.matrixWorldInverse);
        if (-vector.z > camera.near) {
          vector.applyMatrix4(camera.projectionMatrix);
          moonDisks.push({ key: body.name, x: (vector.x + 1) * size.width / 2, y: (1 - vector.y) * size.height / 2,
            radius: spherePixels, distance, center: view.toArray(), radiusPc });
        }
      }
      attributes.alpha[i] = smoothRange(orbitPixels, ...MARKER_PIXELS) * (1 - smoothRange(spherePixels, ...SPHERE_PIXELS)) * (major ? 1 : 0.7);
      const isFocused = String(body.moon.code) === focused;
      const named = body.radiusKm >= LABEL_RADIUS_KM;
      // Las pequeñas: de cerca (esfera visible) o con el ratón encima (se decide al proyectarla).
      const labelAlpha = isFocused ? 1 : named ? presence : smoothRange(spherePixels, ...SMALL_SPHERE_PIXELS);
      if ((labelAlpha < 0.02 && (named || presence < 0.5)) || !container || hiddenByPlanet(cx, cy, cz, body.offsetPc, planetRadiusPc)) return;
      view.set(center[0] - origin[0] + body.offsetPc[0], center[1] - origin[1] + body.offsetPc[1], center[2] - origin[2] + body.offsetPc[2]);
      vector.copy(view).applyMatrix4(camera.matrixWorldInverse);
      if (-vector.z <= camera.near) return;
      vector.applyMatrix4(camera.projectionMatrix);
      // Junto al borde de la pantalla el nombre se funde en vez de cortarse de golpe.
      const edge = (1 - smoothRange(Math.abs(vector.x), 0.9, 0.99)) * (1 - smoothRange(Math.abs(vector.y), 0.84, 0.95));
      if (edge < 0.02) return;
      const screenX = (vector.x + 1) * size.width / 2, screenY = (1 - vector.y) * size.height / 2;
      // Con el ratón sobre una luna chica; no cuenta mientras su punto se confunde con el del planeta.
      const hovered = !named && pointerOnCanvas.value && Math.hypot(pointerX - screenX, pointerY - screenY) - spherePixels < HOVER_PIXELS
        && orbitPixels > 2 * HOVER_PIXELS;
      const alpha = (hovered && presence > 0.5 ? Math.max(labelAlpha, 0.9) : labelAlpha) * edge;
      if (alpha < 0.02) return;
      const item = { code: String(body.moon.code), alpha, hovered: hovered && presence > 0.5, priority: isFocused ? Infinity : body.radiusKm,
        x: screenX + Math.min(spherePixels, size.width / 3) + 8, y: screenY - 8, width: body.name.length * 6.2 + 8 };
      if (!isFocused && hiddenBehind({ x: item.x, y: item.y, width: item.width, height: 16 }, distance, occluders, body.name)) return;
      candidates.push(item);
    });
    publishOccluders(`lunas-${planet}`, moonDisks);
    assignNear(near.sort((a, b) => b[1] - a[1]).slice(0, NEAR_POOL).map(([index]) => index).sort((a, b) => a - b));
    // Mapa de superficie en las esferas sueltas, cuando ya ocupan unos píxeles.
    const pixelsOf = new Map(near);
    nearState.current.forEach((index, k) => {
      const mesh = pool.current[k], body = moons[index], url = moonTextureUrl(body.moon.code);
      if (!mesh || !url || mesh.userData.textured || !(pixelsOf.get(index) > TEXTURE_PIXELS)) return;
      const texture = moonTexture(url, invalidate);
      if (!texture) return;
      mesh.material.map = texture;
      mesh.material.color.setStyle(body.color, SRGBColorSpace).lerp(WHITE, 0.5);
      mesh.material.needsUpdate = true;
      mesh.userData.textured = true;
    });
    points.current.geometry.attributes.alpha.needsUpdate = true;
    material.current.uniforms.pixelRatio.value = gl.getPixelRatio();
    if (!container) return;
    // Sin solapes. Orden: la luna enfocada; las grandes (primero las que ya estaban a la vista); las
    // pequeñas que ya estaban; las pequeñas nuevas; dentro de cada grupo, de mayor a menor radio. Un
    // nombre nuevo necesita un margen libre; uno que ya estaba solo se retira si de verdad se encima con
    // otro. Antes se rehacía todo en cada cuadro y, al girar la cámara, los nombres cerca del límite se
    // apagaban y encendían (parpadeo).
    const shown = state.shown;
    const rank = item => item.priority === Infinity || item.hovered ? 0 : item.priority >= LABEL_RADIUS_KM ? (shown.has(item.code) ? 1 : 2)
      : shown.has(item.code) ? 3 : 4;
    candidates.sort((a, b) => rank(a) - rank(b) || b.priority - a.priority);
    const placed = [], next = new Set();
    for (const item of candidates) {
      if (placed.length >= MAX_LABELS) break;
      const margin = shown.has(item.code) ? 0 : LABEL_MARGIN;
      if (placed.some(other => item.x < other.x + other.width + margin && other.x < item.x + item.width + margin
        && Math.abs(item.y - other.y) < 14 + margin)) continue;
      placed.push(item);
      next.add(item.code);
    }
    state.shown = next;
    // Aparecer y desaparecer se funden (≈ 200 ms, como los nombres de estrellas). Un nombre que sale
    // queda en su último lugar mientras se apaga (o donde está ahora, si sigue siendo candidato).
    const step = 1 - Math.exp(-LABEL_FADE * delta);
    const byCode = new Map(candidates.map(item => [item.code, item]));
    for (const item of placed) {
      const current = state.fading.get(item.code);
      state.fading.set(item.code, { alpha: current?.alpha ?? 0, target: item.alpha, x: item.x, y: item.y });
    }
    for (const [code, previous] of [...state.fading]) {
      const item = byCode.get(code);
      const leaving = !next.has(code);
      const target = leaving ? 0 : previous.target;
      const entry = { target, alpha: previous.alpha + (target - previous.alpha) * step,
        x: leaving && item ? item.x : previous.x, y: leaving && item ? item.y : previous.y };
      state.fading.set(code, entry);
      const element = state.elements.get(code);
      if (entry.target === 0 && entry.alpha < 0.02) {
        state.fading.delete(code);
        if (element) { element.style.opacity = 0; element.style.visibility = 'hidden'; }
        continue;
      }
      if (!element) continue;
      // Escribir en el DOM solo lo que cambia: con decenas de nombres por cuadro se nota.
      const opacity = entry.alpha.toFixed(2), transform = `translate(${Math.round(entry.x)}px, ${Math.round(entry.y)}px)`;
      if (element.style.opacity !== opacity) element.style.opacity = opacity;
      if (element.style.visibility !== 'visible') element.style.visibility = 'visible';
      if (element.style.transform !== transform) element.style.transform = transform;
    }
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
    <FadingTrails trails={trails} fadePixels={TRAIL_FADE} opacity={0.65} width={1.6} fadeDistance={TRAIL_DISTANCE} />
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
