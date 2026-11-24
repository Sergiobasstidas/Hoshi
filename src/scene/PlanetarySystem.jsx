import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { AdditiveBlending, Color, SRGBColorSpace, Vector2, Vector3 } from 'three';
import { mantenerActivo } from './reposo';
import { pedirMapas, soltarMapas } from './eyes/texturaExoplaneta';
import { AU_TO_PC, smoothRange } from './scale';
import { planetOrbitPc } from './exoplanetOrbit';
import { useOrbitas } from './guiasOrbitales';
import OrbitLine, { ORBIT_LINE_COLOR } from './OrbitLine';
import { colorCatalogo } from './visualBinary';

// Planetas de las anfitrionas del catálogo (NASA Exoplanet Archive). Órbitas y radios a
// escala física; de lejos cada planeta es un marcador de tamaño fijo que no representa su
// radio. De cerca, el aspecto ilustrativo de Eyes on Exoplanets (eyes/recetaEyes.js), con
// iluminación desde la estrella: no hay aspecto medido. Qué
// elementos son supuestos lo declara cada planeta. Véase docs/exoplanets/SISTEMAS_PLANETARIOS.md.
const MAX_ACTIVE = 4;
// Un sistema se activa cuando la cámara está a menos de este múltiplo de su órbita mayor.
const ACTIVATION_RANGE = 500;
// Radio aparente de la órbita, en píxeles, entre los que aparecen línea, marcador y nombre.
const ORBIT_PIXELS = [8, 35], MARKER_PIXELS = [10, 30], LABEL_PIXELS = [22, 60];
// El marcador se retira cuando la esfera física ya ocupa estos píxeles de radio.
const SPHERE_PIXELS = [1.5, 4];
// Binaria anfitriona: tamaño aparente de su órbita entre los que aparecen las curvas de
// las dos estrellas y sus nombres.
const STAR_ORBIT_PIXELS = [3, 14], STAR_LABEL_PIXELS = [25, 70];

// Esfera del planeta. Con mapa (el de Eyes on Exoplanets, eyes/texturaExoplaneta.js), su color; sin él, el tono
// de su temperatura de equilibrio. El mapa normal y el especular, cuando los hay, con la estrella como única luz.
const sphereVertex = `
  varying vec3 worldNormal;
  varying vec3 worldTangent;
  varying vec3 worldPosition;
  varying vec2 vUv;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    worldNormal = normalize(mat3(modelMatrix) * normal);
    // Dirección este de la esfera (hacia donde crece u en SphereGeometry), para el mapa normal. Sin la escala del modelo
    // (en pc, diminuta), que la dejaba siempre bajo el umbral del fragmento y el mapa normal nunca se aplicaba.
    worldTangent = mat3(modelMatrix) * vec3(position.z, 0.0, -position.x) / length(modelMatrix[0].xyz);
    worldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }`;
// Lambert con la estrella como única fuente: la fase que se ve es geométrica.
const sphereFragment = `
  uniform vec3 tint;
  uniform vec3 towardStar;
  uniform sampler2D map;
  uniform sampler2D normalMap;
  uniform sampler2D specularMap;
  uniform float hasMap;
  uniform float hasNormal;
  uniform float hasSpecular;
  uniform vec2 normalScale;
  varying vec3 worldNormal;
  varying vec3 worldTangent;
  varying vec3 worldPosition;
  varying vec2 vUv;
  #include <logdepthbuf_pars_fragment>
  void main() {
    vec3 n = normalize(worldNormal);
    float lt = length(worldTangent);
    if (hasNormal > 0.5 && lt > 1e-5) {
      vec3 t = normalize(worldTangent / lt - n * dot(n, worldTangent / lt));
      vec3 m = texture2D(normalMap, vUv).xyz * 2.0 - 1.0;
      m.xy *= normalScale;
      n = normalize(t * m.x + cross(n, t) * m.y + n * m.z);
    }
    float light = max(0.0, dot(n, towardStar));
    vec3 base = hasMap > 0.5 ? texture2D(map, vUv).rgb : tint;
    vec3 color = base * (0.04 + 0.96 * light);
    if (hasSpecular > 0.5) {
      vec3 h = normalize(towardStar + normalize(cameraPosition - worldPosition));
      color += vec3(0.5) * pow(max(dot(n, h), 0.0), 30.0) * texture2D(specularMap, vUv).r * step(0.0, dot(normalize(worldNormal), towardStar));
    }
    gl_FragColor = vec4(color, 1.0);
    #include <logdepthbuf_fragment>
    #include <colorspace_fragment>
  }`;

// Radio en pantalla (px) desde el que se piden los mapas del planeta (como las lunas) y por debajo del cual se sueltan.
const TEXTURE_PIXELS = 20, RELEASE_PIXELS = 3;
const focalDe = (camera, size) => size.height / (2 * Math.tan(camera.fov * Math.PI / 360));

function PlanetSphere({ planet }) {
  const mesh = useRef(), material = useRef(), estado = useRef({ pedido: false, vigente: null });
  const uniforms = useMemo(() => ({
    tint: { value: new Color().setRGB(...planet.color, SRGBColorSpace) },
    towardStar: { value: new Vector3(...planet.offsetPc).normalize().negate() },
    map: { value: null }, normalMap: { value: null }, specularMap: { value: null },
    hasMap: { value: 0 }, hasNormal: { value: 0 }, hasSpecular: { value: 0 }, normalScale: { value: new Vector2(1, 1) },
  }), [planet]);
  const centro = useMemo(() => new Vector3(), []);
  // Suelta los mapas (al achicarse el planeta en pantalla o al salir el sistema) y vuelve al tono liso.
  const quitar = useCallback(() => {
    const e = estado.current;
    if (!e.pedido) return;
    e.pedido = false;
    e.vigente = null;
    soltarMapas(planet);
    const u = material.current?.uniforms;
    if (u) { u.hasMap.value = u.hasNormal.value = u.hasSpecular.value = 0; u.map.value = u.normalMap.value = u.specularMap.value = null; }
    mesh.current?.quaternion.identity();
  }, [planet]);
  useEffect(() => quitar, [quitar]);
  useFrame(({ camera, size }) => {
    if (!mesh.current || !material.current) return;
    const pixels = planet.radiusPc / mesh.current.getWorldPosition(centro).distanceTo(camera.position) * focalDe(camera, size);
    const e = estado.current;
    if (!e.pedido && pixels > TEXTURE_PIXELS) {
      e.pedido = true;
      const vigente = e.vigente = {};
      pedirMapas(planet).then(m => {
        const u = material.current?.uniforms;
        if (e.vigente !== vigente || !u) return;
        u.map.value = m.mapa; u.hasMap.value = 1;
        if (m.normal) { u.normalMap.value = m.normal; u.hasNormal.value = 1; u.normalScale.value.set(...m.escalaNormal); }
        if (m.especular) { u.specularMap.value = m.especular; u.hasSpecular.value = 1; }
        // Rotación sincrónica (Kepler-7 b y TRAPPIST-1 f en Eyes): el eje indicado mira a la estrella.
        if (m.sincronica) mesh.current?.quaternion.setFromUnitVectors(new Vector3(...m.sincronica), u.towardStar.value);
        mantenerActivo();
      }).catch(() => {});
    } else if (e.pedido && pixels < RELEASE_PIXELS) quitar();
  });
  return <mesh ref={mesh} position={planet.offsetPc} scale={planet.radiusPc}>
    <sphereGeometry args={[1, 64, 48]} />
    <shaderMaterial ref={material} uniforms={uniforms} vertexShader={sphereVertex} fragmentShader={sphereFragment} toneMapped={false} />
  </mesh>;
}

function ActiveSystem({ system, origin, onSelect }) {
  const lines = useRef(), material = useRef(), points = useRef(), labels = useRef([]);
  const starLines = useRef(), starLabels = useRef([]), starGlows = useRef([]);
  const orbitas = useOrbitas();
  const position = useMemo(() => system.position.map((v, i) => v - origin[i]), [system, origin]);
  // Las dos estrellas de un sistema circumbinario, cada una en su órbita en torno al
  // centro de masas (el punto del catálogo). Las esferas las dibuja StarField.
  const pair = system.binary?.components || null;
  const orbits = useMemo(() => system.planets.map(planet => planetOrbitPc(planet, system.sky, 1024, planet.offsetPc)), [system]);
  // Órbitas de los planetas en el tono vivo de su estrella (como las estrellas dobles); sin color de catálogo, azules. Se
  // escala al canal más alto del azul de siempre (0,79) para que el brillo sea comparable.
  const colorOrbitas = system.star?.rgb
    ? `rgb(${colorCatalogo(system.star).map(v => Math.round(v * 0.79)).join(',')})` : ORBIT_LINE_COLOR;
  const attributes = useMemo(() => ({
    position: new Float32Array(system.planets.flatMap(planet => planet.offsetPc)),
    color: new Float32Array(system.planets.flatMap(planet => planet.color)),
    alpha: new Float32Array(system.planets.length),
  }), [system]);
  const uniforms = useMemo(() => ({ pixelRatio: { value: 1 } }), []);
  useFrame(({ camera, gl, size }) => {
    const focal = size.height / (2 * Math.tan(camera.fov * Math.PI / 360));
    const hostDistance = Math.hypot(camera.position.x - position[0], camera.position.y - position[1], camera.position.z - position[2]);
    system.planets.forEach((planet, i) => {
      const orbitPixels = planet.a * AU_TO_PC / hostDistance * focal;
      const line = lines.current.children[i];
      line.material.opacity = smoothRange(orbitPixels, ...ORBIT_PIXELS);
      line.visible = line.material.opacity > 0.004;
      const distance = Math.hypot(camera.position.x - position[0] - planet.offsetPc[0],
        camera.position.y - position[1] - planet.offsetPc[1], camera.position.z - position[2] - planet.offsetPc[2]);
      const spherePixels = planet.radiusPc === null ? 0 : planet.radiusPc / distance * focal;
      attributes.alpha[i] = smoothRange(orbitPixels, ...MARKER_PIXELS) * (1 - smoothRange(spherePixels, ...SPHERE_PIXELS));
      const label = labels.current[i];
      if (label) {
        label.style.opacity = smoothRange(orbitPixels, ...LABEL_PIXELS);
        label.style.pointerEvents = planet.body && label.style.opacity > 0.5 ? 'auto' : 'none';
      }
    });
    if (pair) {
      const pixels = system.binary.apoapsisPc / hostDistance * focal;
      const opacity = 0.5 * smoothRange(pixels, ...STAR_ORBIT_PIXELS);
      starLines.current.children.forEach(line => { line.material.opacity = opacity; line.visible = opacity > 0.004; });
      // El brillo de cada órbita sigue a su trazo, como en las estrellas dobles (CompanionStars.jsx).
      starGlows.current.forEach(glow => { if (glow) { glow.material.opacity = 0.16 * opacity / 0.45; glow.visible = opacity > 0.004; } });
      starLabels.current.forEach((label, i) => {
        if (!label) return;
        // El nombre se retira cuando la esfera de la estrella ya llena la vista.
        const offset = pair[i].offsetPc, radius = pair[i].physics?.radiusPc || 0;
        const distance = Math.hypot(camera.position.x - position[0] - offset[0], camera.position.y - position[1] - offset[1], camera.position.z - position[2] - offset[2]);
        label.style.opacity = smoothRange(pixels, ...STAR_LABEL_PIXELS) * (1 - smoothRange(radius / distance * focal, 40, 90));
        label.style.pointerEvents = pair[i].body && label.style.opacity > 0.5 ? 'auto' : 'none';
      });
    }
    points.current.geometry.attributes.alpha.needsUpdate = true;
    material.current.uniforms.pixelRatio.value = gl.getPixelRatio();
  });
  return <group position={position}>
    <group ref={lines}>
      {orbits.map((orbit, i) => <OrbitLine key={system.planets[i].n} points={orbit} color={colorOrbitas} />)}
    </group>
    {pair && <group ref={starLines} visible={orbitas}>
      {pair.map(component => <line key={component.name} frustumCulled={false}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[component.orbit, 3]} /></bufferGeometry>
        <lineBasicMaterial color={`rgb(${colorCatalogo(component.star).join(',')})`} transparent opacity={0} depthWrite={false} />
      </line>)}
    </group>}
    {pair?.map((component, i) => <OrbitLine key={`brillo-${component.name}`} ref={glow => { starGlows.current[i] = glow; }} points={component.orbit}
      variant="brillo" color={`rgb(${colorCatalogo(component.star).join(',')})`} visible={orbitas} />)}
    {pair?.map((component, i) => <Html key={component.name} position={component.offsetPc} zIndexRange={[18, 10]} style={{ pointerEvents: 'none' }}>
      <span ref={element => { starLabels.current[i] = element; }} className="companion-label" style={{ opacity: 0, cursor: component.body ? 'pointer' : 'default' }}
        onClick={() => component.body && onSelect?.(component.body)}
        title={component.body ? `Acercarse a ${component.name}` : 'Sin radio y temperatura publicados: marcador'}>{component.name}</span>
    </Html>)}
    {system.planets.map(planet => planet.radiusPc !== null && <PlanetSphere key={planet.n} planet={planet} />)}
    <points ref={points} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[attributes.position, 3]} />
        <bufferAttribute attach="attributes-color" args={[attributes.color, 3]} />
        <bufferAttribute attach="attributes-alpha" args={[attributes.alpha, 1]} />
      </bufferGeometry>
      <shaderMaterial ref={material} transparent depthWrite={false} toneMapped={false} blending={AdditiveBlending} uniforms={uniforms}
        vertexShader={`
          uniform float pixelRatio;
          attribute vec3 color;
          attribute float alpha;
          varying vec3 tint;
          varying float fade;
          #include <common>
          #include <logdepthbuf_pars_vertex>
          void main() {
            tint = color;
            fade = alpha;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = 7.0 * pixelRatio;
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
    {system.planets.map((planet, i) => <Html key={planet.n} position={planet.offsetPc} zIndexRange={[18, 10]} style={{ pointerEvents: 'none' }}>
      <span ref={element => { labels.current[i] = element; }} className="companion-label" style={{ opacity: 0, cursor: planet.body ? 'pointer' : 'default' }}
        onClick={() => planet.body && onSelect?.(planet.body)}
        title={planet.body ? `Acercarse a ${planet.n}` : 'Radio desconocido: sin esfera'}>{planet.n}{planet.s.includes('f') ? ' · posición ilustrativa' : ''}</span>
    </Html>)}
  </group>;
}

export default function PlanetarySystems({ systems, origin, onSelect }) {
  const [active, setActive] = useState([]);
  const key = useRef('');
  useFrame(({ camera }) => {
    const x = camera.position.x + origin[0], y = camera.position.y + origin[1], z = camera.position.z + origin[2];
    const near = [];
    for (const system of systems) {
      const distance = Math.hypot(x - system.position[0], y - system.position[1], z - system.position[2]);
      if (distance < system.rangePc * ACTIVATION_RANGE) near.push({ system, distance });
    }
    near.sort((a, b) => a.distance - b.distance);
    const next = near.slice(0, MAX_ACTIVE).map(entry => entry.system);
    const nextKey = next.map(system => system.id).join('|');
    if (nextKey !== key.current) { key.current = nextKey; setActive(next); }
  });
  return active.map(system => <ActiveSystem key={system.id} system={system} origin={origin} onSelect={onSelect} />);
}
