import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { AU_TO_PC, LIGHT_YEAR_PC, SUN_RADIUS_PC, backgroundGain, skyExposure, smoothRange, stellarVisualWeight } from './scale';
import { STAR_STOP_PC } from './starHeading';
import { buildStellarAppearance, stellarMarkerSize } from './stellarAppearance';
import { catalogueGalaxyGain } from './galaxy.js';
import { PROXIMA_HSB, nombreProxima, parametrosBrillo } from './modosBrillo';
import StellarSurface from './StellarSurface';
import { M_MIN, M_STEP, escalasDeGrupo, tablaColores } from './gaiaCapa.js';
import { posicionesCapa } from './estrellasBin.js';
import { geometriaSoltada } from './geometriaGpu.js';

const vertexShader = `
  attribute float luminosity;
  attribute float individualLuminosity;
  attribute float markerSize;
  attribute vec3 vividColor;
  attribute float absoluteMagnitude;
  uniform float named;
  uniform float exposure;
  uniform float pixelRatio;
  uniform float distantSize;
  uniform float farCompression;
  uniform float individualMix;
  uniform float fisico;
  uniform float limite;
  uniform float ganancia;
  uniform float inspect;
  uniform float physicalRadius;
  uniform float realce;
  uniform float latido;
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
    // Resolver fuentes lejanas progresivamente menores para evitar acumular
    // cientos de halos de tamaño fijo en un disco blanco.
    float farView = smoothstep(300.0, 3000.0, distanceToEye) * farCompression;
    float sizeReduction = mix(mix(1.0, 0.65, farView), mix(1.0, 0.5, farView), named);
    float individualSize = mix(1.0, markerSize, individualMix);
    float inspectionSize = inspect * (physicalRadius > 0.0 ? 0.0 : 90.0) * (1.0 - smoothstep(${STAR_STOP_PC}, ${5000 * AU_TO_PC}, length(mvPosition.xyz)));
    gl_PointSize = (1.15 * mix(backgroundSize, namedSize, named) * distantSize * sizeReduction * individualSize + inspectionSize) * pixelRatio;
    vAlpha = exposure * mix(luminosity, individualLuminosity, individualMix)
      * mix(0.36, mix(1.0, 0.65, farView), named);
    // Los puntos de fondo densos y sin resolver también requieren reducir energía:
    // reducirlos a menos de un píxel deja su muestra central demasiado brillante.
    vAlpha *= mix(mix(1.0, 0.25, farView), 1.0, named);
    // Como el ojo: muestra su color lo que se ve brillante, ya sea por su brillo real desde la cámara
    // o por el que tiene en pantalla; lo que apenas se ve tiende a blanco.
    float apparentMagnitude = absoluteMagnitude + 5.0 * (log(max(distanceToEye, 1e-6) / 10.0) / log(10.0));
    if (fisico > 0.5) {
      vAlpha = clamp(0.08 * pow(10.0, 0.4 * (limite - apparentMagnitude)), 0.0, 1.0) * ganancia;
      gl_PointSize = (clamp(2.5 + 1.6 * (limite - apparentMagnitude), 1.5, 34.0) + inspectionSize) * pixelRatio;
    }
    // Miembros de un cúmulo elegido: visibles sea cual sea su magnitud o el modo de brillo, con un punto algo
    // mayor y un realce fijo (latido). Solo multiplicar el brillo no se nota: las brillantes ya están al tope
    // y las débiles siguen bajo el límite.
    vAlpha = mix(vAlpha, max(vAlpha, 0.6), realce) * (1.0 + 0.7 * latido);
    gl_PointSize = mix(gl_PointSize, max(gl_PointSize, 9.0 * pixelRatio) * 1.25, realce) * (1.0 + 0.6 * latido);
    float saturation = max(1.0 - smoothstep(1.0, 3.0, apparentMagnitude), smoothstep(0.22, 0.5, vAlpha));
    vColor = mix(vec3(0.92), vividColor, saturation);
    // Atenuar el marcador al resolverse el disco estelar real. No dibujar
    // un punto grande sobre una fotosfera con textura.
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
  #include <logdepthbuf_pars_fragment>
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(p, p);
    // Gaussianas continuas: sin disco sólido, anillos ni cruces de difracción.
    float core = exp(-r2 * mix(6.0, 65.0, named));
    float halo = exp(-r2 * 12.0) * 0.35 * named * vHalo;
    float edge = 1.0 - smoothstep(0.65, 1.0, r2);
    float whitening = mix(0.02, 0.12, named);
    vec3 color = mix(vColor, vec3(1.0), core * whitening);
    gl_FragColor = vec4(color, (core + halo) * edge * vAlpha);
    #include <logdepthbuf_fragment>
  }
`;

// `fundido`: ref con un factor de brillo que cambia cuadro a cuadro (la atenuación al elegir un cúmulo).
// `destaque`: ref con { realce, latido } para los miembros de un cúmulo elegido.
function StarGroup({ stars, named, origin, anchor, physicalRadius = 0, solar = false, gain = 1, fundido = null, destaque = null }) {
  const materialRef = useRef();
  const attributes = useMemo(() => {
    const position = new Float32Array(stars.length * 3);
    stars.forEach((star, i) => {
      // Restar en doble precisión en CPU antes de transferir a Float32 en GPU.
      position.set(anchor ? [0, 0, 0] : [star.x - origin[0], star.y - origin[1], star.z - origin[2]], i * 3);
    });
    return { position, ...buildStellarAppearance(stars) };
  }, [stars, origin, anchor]);
  const uniforms = useMemo(() => ({ named: { value: named ? 1 : 0 },
    exposure: { value: 0.13 }, pixelRatio: { value: 1 }, distantSize: { value: 1 },
    farCompression: { value: 0 }, individualMix: { value: 0 }, fisico: { value: 0 }, limite: { value: 6 }, ganancia: { value: 1 }, inspect: { value: anchor ? 1 : 0 },
    physicalRadius: { value: physicalRadius }, realce: { value: 0 }, latido: { value: 0 } }), [named, anchor, physicalRadius]);
  useFrame(({ camera, gl }) => {
    const distance = Math.hypot(camera.position.x + origin[0], camera.position.y + origin[1], camera.position.z + origin[2]);
    const factor = gain * (fundido?.current ?? 1);
    materialRef.current.uniforms.exposure.value = skyExposure(distance, named) * (named ? 1 : backgroundGain(distance)) * factor * (anchor ? 1 : catalogueGalaxyGain(distance));
    if (solar) materialRef.current.uniforms.exposure.value *= smoothRange(distance, 0.015 * LIGHT_YEAR_PC, 0.02 * LIGHT_YEAR_PC);
    materialRef.current.uniforms.pixelRatio.value = gl.getPixelRatio();
    materialRef.current.uniforms.realce.value = destaque ? 1 : 0;
    materialRef.current.uniforms.latido.value = destaque?.current.latido ?? 0;
    const { fisico, limite } = parametrosBrillo();
    materialRef.current.uniforms.fisico.value = fisico;
    materialRef.current.uniforms.limite.value = limite;
    materialRef.current.uniforms.ganancia.value = factor * (anchor ? 1 : catalogueGalaxyGain(distance));
    materialRef.current.uniforms.individualMix.value = smoothRange(distance, 4, 12);
    materialRef.current.uniforms.farCompression.value = THREE.MathUtils.smoothstep(distance, 300, 3000);
    materialRef.current.uniforms.distantSize.value = 1 - 0.22
      * THREE.MathUtils.smoothstep(distance, 50, 300);
  });
  return (
    <points frustumCulled={false} position={anchor}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[attributes.position, 3]} />
        <bufferAttribute attach="attributes-luminosity" args={[attributes.luminosity, 1]} />
        <bufferAttribute attach="attributes-individualLuminosity" args={[attributes.individualLuminosity, 1]} />
        <bufferAttribute attach="attributes-markerSize" args={[attributes.markerSize, 1]} />
        <bufferAttribute attach="attributes-absoluteMagnitude" args={[attributes.absoluteMagnitude, 1]} />
        <bufferAttribute attach="attributes-vividColor" args={[attributes.vividColor, 3]} />
      </bufferGeometry>
      <shaderMaterial ref={materialRef} uniforms={uniforms} vertexShader={vertexShader}
        fragmentShader={fragmentShader} transparent depthWrite={false} depthTest
        blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  );
}

// === Cielo unido: estrellas del catálogo (con nombre y de fondo) y capa de Gaia/GCNS en un solo dibujo ===
// Cada estrella lleva su clase (0 capa, 1 fondo, 2 con nombre, 3 oculta) y el shader aplica a cada una las mismas
// reglas que tenían StarGroup (catálogo) y la antigua capa de Gaia, así que el resultado es el mismo con un solo dibujo.
// Capa: más tenue que las estrellas de Hoshi en Mapa, con un piso dentro de la galaxia y sin seguir más allá de
// 6.000 años luz (valores de la antigua EstrellasGaia.jsx).
const TENUE_CAPA = 0.4, PISO_GALAXIA_CAPA = 0.4, PISO_HASTA_AL = [30000, 60000], EXTENSION_CAPA_AL = 6000;
const CLASE = { capa: 0, fondo: 1, nombre: 2, oculta: 3 };
const unidoVertex = `
  attribute float magnitud;
  attribute vec3 tinte;
  attribute float clase;
  uniform sampler2D tablaColor;
  uniform float exposicion[3];
  uniform float ganancia[3];
  uniform float areaScale[3];
  uniform float energyScale[3];
  uniform float tenue;
  uniform float pixelRatio;
  uniform float distantSize;
  uniform float farCompression;
  uniform float individualMix;
  uniform float fisico;
  uniform float limite;
  uniform vec3 proximaPos;
  uniform float proximaAlpha;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vHalo;
  varying float vNamed;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    if (clase > 2.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vAlpha = 0.0; vNamed = 0.0; vHalo = 0.0; vColor = vec3(0.0); return; }
    int k = int(clase + 0.5);
    float esCapa = k == 0 ? 1.0 : 0.0;
    float named = k == 2 ? 1.0 : 0.0;
    float exposure = k == 0 ? exposicion[0] : k == 1 ? exposicion[1] : exposicion[2];
    float gananciaK = k == 0 ? ganancia[0] : k == 1 ? ganancia[1] : ganancia[2];
    float area = k == 0 ? areaScale[0] : k == 1 ? areaScale[1] : areaScale[2];
    float energia = k == 0 ? energyScale[0] : k == 1 ? energyScale[1] : energyScale[2];
    vec4 tabla = texture2D(tablaColor, vec2((tinte.r * 255.0 + 0.5) / 256.0, 0.5));
    float absoluteMagnitude = esCapa > 0.5 ? magnitud - tabla.a : magnitud;
    vec3 vividColor = esCapa > 0.5 ? tabla.rgb : pow(tinte, vec3(2.1));
    float luminosity = clamp(1.0 - absoluteMagnitude * 0.018, 0.65, 1.15);
    float markerSize = (0.45 + 1.8 / (1.0 + exp((absoluteMagnitude - 1.0) * 0.5))) * area;
    float individualLuminosity = clamp(pow(2.0, (1.3 - absoluteMagnitude) * 0.15), 0.45, 1.5) * energia;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float distanceToEye = max(length(mvPosition.xyz), 0.001);
    float nearSize = 1.0 / sqrt(distanceToEye + 0.5);
    float backgroundSize = clamp(2.8 + 2.5 * nearSize, 2.8, 5.5);
    float namedSize = clamp(25.0 + 15.0 * nearSize, 25.0, 40.0);
    float farView = smoothstep(300.0, 3000.0, distanceToEye) * farCompression;
    float sizeReduction = mix(mix(1.0, 0.65, farView), mix(1.0, 0.5, farView), named);
    float individualSize = mix(1.0, markerSize, individualMix);
    float tamanoLejano = esCapa > 0.5 ? 1.0 : distantSize;
    gl_PointSize = 1.15 * mix(backgroundSize, namedSize, named) * tamanoLejano * sizeReduction * individualSize * pixelRatio;
    vAlpha = exposure * mix(luminosity, individualLuminosity, individualMix)
      * mix(0.36, mix(1.0, 0.65, farView), named) * (esCapa > 0.5 ? tenue : 1.0);
    vAlpha *= mix(mix(1.0, 0.25, farView), 1.0, named);
    float apparentMagnitude = absoluteMagnitude + 5.0 * (log(max(distanceToEye, 1e-6) / 10.0) / log(10.0));
    if (fisico > 0.5) {
      vAlpha = clamp(0.08 * pow(10.0, 0.4 * (limite - apparentMagnitude)), 0.0, 1.0) * gananciaK;
      gl_PointSize = clamp(2.5 + 1.6 * (limite - apparentMagnitude), 1.5, 34.0) * pixelRatio;
      // Proxima, mientras su nombre se ve (modosBrillo.js): al menos como una estrella apenas visible.
      float proxima = esCapa < 0.5 && length(position - proximaPos) < 1e-5 ? proximaAlpha : 0.0;
      vAlpha = max(vAlpha, proxima * 0.08 * gananciaK);
      gl_PointSize = max(gl_PointSize, proxima * 2.5 * pixelRatio);
    }
    float saturation = max(1.0 - smoothstep(1.0, 3.0, apparentMagnitude), smoothstep(0.22, 0.5, vAlpha));
    vColor = mix(vec3(0.92), vividColor, saturation);
    vHalo = mix(1.0, 0.2, farView);
    vNamed = named;
    gl_Position = projectionMatrix * mvPosition;
    if (esCapa > 0.5 && vAlpha < 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    #include <logdepthbuf_vertex>
  }
`;
const unidoFragment = `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vHalo;
  varying float vNamed;
  #include <logdepthbuf_pars_fragment>
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(p, p);
    float core = exp(-r2 * mix(6.0, 65.0, vNamed));
    float halo = exp(-r2 * 12.0) * 0.35 * vNamed * vHalo;
    float edge = 1.0 - smoothstep(0.65, 1.0, r2);
    float whitening = mix(0.02, 0.12, vNamed);
    vec3 color = mix(vColor, vec3(1.0), core * whitening);
    gl_FragColor = vec4(color, (core + halo) * edge * vAlpha);
    #include <logdepthbuf_fragment>
  }
`;

// Escalas de área y energía de un grupo del catálogo, las mismas de buildStellarAppearance.
function escalasCatalogo(lista) {
  if (!lista.length) return { areaScale: 1, energyScale: 1 };
  let area = 0, luz = 0;
  const marcador = [], peso = [];
  for (const star of lista) {
    const m = Number.isFinite(star.m) ? star.m : 1.3;
    const t = stellarMarkerSize(m);
    marcador.push(t); peso.push(stellarVisualWeight(m));
    area += t * t; luz += Math.max(0.65, Math.min(1.15, 1 - m * 0.018));
  }
  const areaScale = Math.sqrt(lista.length / area);
  let energia = 0;
  for (let k = 0; k < lista.length; k++) energia += peso[k] * (marcador[k] * areaScale) ** 2;
  return { areaScale, energyScale: energia ? luz / energia : 1 };
}

function CieloUnido({ catalogo, capa, visibles, aparte, origin, gain, fundido }) {
  const materialRef = useRef();
  const invalidate = useThree(state => state.invalidate);
  const nCat = catalogo.length, nCapa = capa?.n ?? 0, total = nCat + nCapa;
  // Clase base de cada estrella, escalas de grupo y tabla de color de la capa.
  const fijos = useMemo(() => {
    const claseBase = new Uint8Array(total);
    catalogo.forEach((star, k) => { claseBase[k] = star.n === 'Sol' || star.n === 'Sun' ? CLASE.oculta : star.n ? CLASE.nombre : CLASE.fondo; });
    claseBase.fill(CLASE.capa, nCat);
    const colores = tablaColores();
    const escalas = [capa ? escalasDeGrupo(capa.magnitudes, capa.colores, Float32Array.from({ length: 256 }, (_, b) => colores[4 * b + 3])) : { areaScale: 1, energyScale: 1 },
      escalasCatalogo(catalogo.filter((s, k) => claseBase[k] === CLASE.fondo)),
      escalasCatalogo(catalogo.filter((s, k) => claseBase[k] === CLASE.nombre))];
    const tabla = new THREE.DataTexture(colores, 256, 1, THREE.RGBAFormat, THREE.FloatType);
    tabla.magFilter = tabla.minFilter = THREE.NearestFilter;
    tabla.needsUpdate = true;
    return { claseBase, escalas, tabla };
  }, [catalogo, capa, total, nCat]);
  // Los atributos se sueltan de la memoria de JavaScript apenas llegan a la GPU (ver geometriaGpu.js).
  const geometria = useMemo(() => {
    const magnitud = new Float32Array(total), tinte = new Uint8Array(3 * total);
    catalogo.forEach((star, k) => {
      magnitud[k] = Number.isFinite(star.m) ? star.m : 99;
      tinte.set(Array.isArray(star.rgb) ? star.rgb : [255, 255, 255], 3 * k);
    });
    for (let k = 0; k < nCapa; k++) { magnitud[nCat + k] = M_MIN + capa.magnitudes[k] * M_STEP; tinte[3 * (nCat + k)] = capa.colores[k]; }
    // Posición y clase cambian con el origen y con la estrella elegida: se reutiliza el mismo atributo (y su búfer en
    // la GPU) con un arreglo nuevo cada vez.
    return geometriaSoltada({
      magnitud: new THREE.BufferAttribute(magnitud, 1),
      tinte: new THREE.BufferAttribute(tinte, 3, true),
      position: new THREE.BufferAttribute(new Float32Array(3 * total), 3),
      clase: new THREE.BufferAttribute(new Uint8Array(total), 1),
    });
  }, [catalogo, capa, total, nCat, nCapa]);
  // Posiciones respecto del origen de la escena, restadas en doble precisión antes de pasar a float32.
  useMemo(() => {
    const p = new Float32Array(3 * total);
    catalogo.forEach((star, k) => { p[3 * k] = star.x - origin[0]; p[3 * k + 1] = star.y - origin[1]; p[3 * k + 2] = star.z - origin[2]; });
    if (capa) posicionesCapa(capa, origin, p, 3 * nCat);
    const atributo = geometria.getAttribute('position');
    atributo.array = p;
    atributo.needsUpdate = true;
  }, [geometria, catalogo, capa, origin, total, nCat]);
  // Clase visible: se ocultan las que no están en `visibles` y las que se dibujan aparte.
  useMemo(() => {
    const c = fijos.claseBase.slice();
    catalogo.forEach((star, k) => { if ((visibles && !visibles.has(star.i)) || aparte.has(star.i)) c[k] = CLASE.oculta; });
    const atributo = geometria.getAttribute('clase');
    atributo.array = c;
    atributo.needsUpdate = true;
  }, [geometria, fijos, catalogo, visibles, aparte]);
  useEffect(() => () => geometria.dispose(), [geometria]);
  useEffect(() => () => fijos.tabla.dispose(), [fijos]);
  useEffect(() => { invalidate(); }, [geometria, origin, visibles, aparte, invalidate]);
  const uniforms = useMemo(() => ({
    tablaColor: { value: null }, exposicion: { value: [0, 0, 0] }, ganancia: { value: [1, 1, 1] },
    areaScale: { value: [1, 1, 1] }, energyScale: { value: [1, 1, 1] }, tenue: { value: TENUE_CAPA },
    pixelRatio: { value: 1 }, distantSize: { value: 1 }, farCompression: { value: 0 }, individualMix: { value: 0 },
    fisico: { value: 0 }, limite: { value: 6 },
    proximaPos: { value: new THREE.Vector3(1e9, 1e9, 1e9) }, proximaAlpha: { value: 0 },
  }), []);
  // Proxima en el catálogo (su punto se refuerza mientras su nombre se ve; ver modosBrillo.js).
  const proxima = useMemo(() => catalogo.find(star => star.i === PROXIMA_HSB), [catalogo]);
  useFrame(({ camera, gl }) => {
    const material = materialRef.current;
    if (!material) return;
    const u = material.uniforms;
    const distance = Math.hypot(camera.position.x + origin[0], camera.position.y + origin[1], camera.position.z + origin[2]);
    const galaxia = catalogueGalaxyGain(distance);
    const factor = gain * (fundido?.current ?? 1);
    u.tablaColor.value = fijos.tabla;
    u.exposicion.value = [
      skyExposure(distance, false) * backgroundGain(distance) * gain * Math.max(galaxia, PISO_GALAXIA_CAPA * (1 - smoothRange(distance / LIGHT_YEAR_PC, ...PISO_HASTA_AL)))
        * Math.min(1, (EXTENSION_CAPA_AL * LIGHT_YEAR_PC / distance) ** 2),
      skyExposure(distance, false) * backgroundGain(distance) * factor * galaxia,
      skyExposure(distance, true) * factor * galaxia,
    ];
    u.ganancia.value = [gain * galaxia, factor * galaxia, factor * galaxia];
    u.areaScale.value = fijos.escalas.map(e => e.areaScale);
    u.energyScale.value = fijos.escalas.map(e => e.energyScale);
    u.pixelRatio.value = gl.getPixelRatio();
    const { fisico, limite } = parametrosBrillo();
    u.fisico.value = fisico;
    u.limite.value = limite;
    u.proximaAlpha.value = proxima ? Math.min(1, nombreProxima.alpha / 0.9) : 0;
    if (proxima) u.proximaPos.value.set(proxima.x - origin[0], proxima.y - origin[1], proxima.z - origin[2]);
    u.individualMix.value = smoothRange(distance, 4, 12);
    u.farCompression.value = THREE.MathUtils.smoothstep(distance, 300, 3000);
    u.distantSize.value = 1 - 0.22 * THREE.MathUtils.smoothstep(distance, 50, 300);
  });
  return (
    <points frustumCulled={false} geometry={geometria}>
      <shaderMaterial ref={materialRef} uniforms={uniforms} vertexShader={unidoVertex} fragmentShader={unidoFragment}
        transparent depthWrite={false} depthTest blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  );
}

// Estrella enfocada o de partida: marcador anclado y, con radio y temperatura, su esfera.
function AnchoredStar({ star, origin, gain }) {
  const stars = useMemo(() => [star], [star]);
  // Restar la traslación del objeto de la cámara con doble precisión en CPU.
  // Un punto centrado en cero conserva precisión de UA al llegar desde coordenadas Float32.
  const anchor = useMemo(() => [star.x - origin[0], star.y - origin[1], star.z - origin[2]], [star, origin]);
  return <>
    <StarGroup gain={gain} stars={stars} named origin={origin} anchor={anchor} physicalRadius={star.physics?.radiusPc} />
    {star.physics && <StellarSurface position={anchor} radiusPc={star.physics.radiusPc} temperatureK={star.physics.temperatureK} />}
  </>;
}
// Una binaria anfitriona de planetas circumbinarios se dibuja como sus dos estrellas, cada
// una en su posición en torno al centro de masas, en lugar del punto único del catálogo.
// El brillo del marcador se reparte para que el par no destaque más que una estrella sola.
const parts = star => star ? star.components || [star] : [];

// `resaltadas`: estrellas que se destacan (los miembros de un cúmulo elegido) con un brillo y un tamaño mínimos y un
// realce fijo que entra con un fundido corto; las demás se atenúan un poco y todo vuelve a la normalidad al soltarlas.
// REALCE_FIJO es el 60 % del pico que tenía el latido descartado.
const ATENUACION = 0.7, REALCE_FIJO = 0.6;
export default function StarField({ stars, catalogo = stars, capa = null, origin, focusedStar, departureStar, gain = 1, resaltadas = null }) {
  const groups = useMemo(() => ({
    solar: stars.filter(s => s.n === 'Sol' || s.n === 'Sun').map(s => ({...s,x:0,y:0,z:0})),
    named: stars.filter(s => s.n && s.n !== 'Sol' && s.n !== 'Sun'),
    background: stars.filter(s => !s.n),
  }), [stars]);
  const retained = departureStar?.i !== focusedStar?.i ? departureStar : null;
  const fundido = useRef(1);
  const destaque = useRef({ latido: 0, de: null });
  useFrame((_, delta) => {
    const paso = Math.min(1, delta * 4);
    fundido.current += ((resaltadas ? ATENUACION : 1) - fundido.current) * paso;
    // Cada grupo nuevo entra desde cero y sube al realce fijo con un fundido corto.
    const d = destaque.current;
    if (d.de !== resaltadas) { d.de = resaltadas; d.latido = 0; }
    d.latido += ((resaltadas ? REALCE_FIJO : 0) - d.latido) * paso;
  });
  const aparte = useMemo(() => new Set([focusedStar?.i, retained?.i, ...(resaltadas || [])]), [focusedStar, retained, resaltadas]);
  // Si `stars` es un subconjunto del catálogo (vista de WR 140), las demás se ocultan en el dibujo unido.
  const visibles = useMemo(() => (stars === catalogo ? null : new Set(stars.map(s => s.i))), [stars, catalogo]);
  // Cada resaltada se dibuja con su mismo tipo de marcador (con nombre o de fondo), solo que más brillante.
  const destacadas = useMemo(() => {
    const elegir = lista => resaltadas ? lista.filter(s => resaltadas.has(s.i) && s.i !== focusedStar?.i && s.i !== retained?.i) : [];
    return { named: elegir(groups.named), background: elegir(groups.background) };
  }, [groups, resaltadas, focusedStar, retained]);
  return <><CieloUnido catalogo={catalogo} capa={capa} visibles={visibles} aparte={aparte} origin={origin} gain={gain} fundido={fundido} />
    {destacadas.background.length > 0 && <StarGroup gain={gain} destaque={destaque} stars={destacadas.background} named={false} origin={origin} />}
    {destacadas.named.length > 0 && <StarGroup gain={gain} destaque={destaque} stars={destacadas.named} named origin={origin} />}
    <StarGroup gain={gain} stars={groups.solar} named solar origin={origin} physicalRadius={SUN_RADIUS_PC} />
    {[focusedStar, retained].flatMap(star => parts(star).map((part, k, all) =>
      <AnchoredStar key={`${part.i}:${k}`} star={part} origin={origin} gain={gain / all.length} />))}
  </>;
}
