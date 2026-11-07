// Capa de fondo con un millón de estrellas de Gaia DR3 (public/data/gaia-1m.bin), aparte del
// catálogo: no entra en la búsqueda, las fichas ni la navegación. Un solo BufferGeometry con las
// vistas tipadas del archivo y un solo draw call de puntos, con el mismo aspecto que las estrellas
// de fondo de StarField. Es estática: no pide cuadros (frameloop «demand»), salvo uno al cargar.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { LIGHT_YEAR_PC, backgroundGain, skyExposure, smoothRange } from './scale';
import { catalogueGalaxyGain } from './galaxy.js';
import { parametrosBrillo } from './modosBrillo';
import { GAIA_URL, M_MIN, M_STEP, escalasDeGrupo, leerGaia, tablaColores } from './gaiaCapa.js';

// En «Mapa» todas se ven sin límite de magnitud: un millón de puntos a la intensidad del catálogo
// taparía el cielo, así que esta capa se dibuja más tenue que las estrellas de Hoshi.
const TENUE_MAPA = 0.4;
// En «Mapa» la capa no se apaga al alejarse (pedido de Sergio, 07/11/2026): sin la atenuación por
// distancia a la cámara de StarField y con un piso para el fundido hacia la vista de la Vía Láctea.
// Ese piso se apaga al salir de la galaxia (entre 30.000 y 60.000 años luz del Sol): desde fuera, el millón
// de puntos cae en un círculo pequeño de la pantalla y, sumados, formaban un manchón blanco sobre el Sol.
const PISO_GALAXIA_MAPA = 0.4, PISO_HASTA_AL = [30000, 60000];
// Visto desde más lejos que la propia capa (el 90 % de sus estrellas está a menos de ~6.000 años luz), el
// millón de puntos se junta en pantalla y su brillo sumado crece con el cuadrado de la distancia: se compensa
// para que la mancha conserve su brillo en vez de saturarse.
const EXTENSION_CAPA_AL = 6000;

// El mismo shader que StarGroup (StarField.jsx) para estrellas de fondo (sin nombre, sin anclar,
// sin realce), con la magnitud y el color leídos de bytes y la tabla de colores en una textura.
const vertexShader = `
  attribute float magnitudByte;
  attribute float colorByte;
  uniform sampler2D tablaColor;
  uniform float exposure;
  uniform float pixelRatio;
  uniform float individualMix;
  uniform float fisico;
  uniform float limite;
  uniform float ganancia;
  uniform float tenue;
  uniform float areaScale;
  uniform float energyScale;
  uniform float farCompression;
  varying vec3 vColor;
  varying float vAlpha;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    vec4 tabla = texture2D(tablaColor, vec2((colorByte * 255.0 + 0.5) / 256.0, 0.5));
    // Magnitud absoluta V = G − (G − V).
    float absoluteMagnitude = ${M_MIN.toFixed(1)} + magnitudByte * 255.0 * ${M_STEP.toFixed(3)} - tabla.a;
    float luminosity = clamp(1.0 - absoluteMagnitude * 0.018, 0.65, 1.15);
    float markerSize = (0.45 + 1.8 / (1.0 + exp((absoluteMagnitude - 1.0) * 0.5))) * areaScale;
    float individualLuminosity = clamp(pow(2.0, (1.3 - absoluteMagnitude) * 0.15), 0.45, 1.5) * energyScale;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float distanceToEye = max(length(mvPosition.xyz), 0.001);
    float nearSize = 1.0 / sqrt(distanceToEye + 0.5);
    float backgroundSize = clamp(2.8 + 2.5 * nearSize, 2.8, 5.5);
    float individualSize = mix(1.0, markerSize, individualMix);
    // La misma compresión de lejos que StarField para el fondo: puntos menores y con menos energía, para
    // no sumar cientos de miles de halos de tamaño fijo en un disco blanco.
    float farView = smoothstep(300.0, 3000.0, distanceToEye) * farCompression;
    gl_PointSize = 1.15 * backgroundSize * mix(1.0, 0.65, farView) * individualSize * pixelRatio;
    vAlpha = exposure * mix(luminosity, individualLuminosity, individualMix) * 0.36 * tenue * mix(1.0, 0.25, farView);
    float apparentMagnitude = absoluteMagnitude + 5.0 * (log(max(distanceToEye, 1e-6) / 10.0) / log(10.0));
    if (fisico > 0.5) {
      vAlpha = clamp(0.08 * pow(10.0, 0.4 * (limite - apparentMagnitude)), 0.0, 1.0) * ganancia;
      gl_PointSize = clamp(2.5 + 1.6 * (limite - apparentMagnitude), 1.5, 34.0) * pixelRatio;
    }
    float saturation = max(1.0 - smoothstep(1.0, 3.0, apparentMagnitude), smoothstep(0.22, 0.5, vAlpha));
    vColor = mix(vec3(0.92), tabla.rgb, saturation);
    gl_Position = projectionMatrix * mvPosition;
    // Bajo el umbral no se rasteriza: fuera del cono de visión del modo, el punto no cuesta fragmentos.
    if (vAlpha < 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    #include <logdepthbuf_vertex>
  }
`;
const fragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;
  #include <logdepthbuf_pars_fragment>
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(p, p);
    float core = exp(-r2 * 6.0);
    float edge = 1.0 - smoothstep(0.65, 1.0, r2);
    vec3 color = mix(vColor, vec3(1.0), core * 0.02);
    gl_FragColor = vec4(color, core * edge * vAlpha);
    #include <logdepthbuf_fragment>
  }
`;

// `activa`: empieza a descargar cuando el catálogo principal ya está listo, para no competir con él.
// `gain`: la misma atenuación que StarField (mapa de púlsares, descubrimientos).
export default function EstrellasGaia({ origin, gain = 1, activa = true }) {
  const [datos, setDatos] = useState(null);
  const invalidate = useThree(state => state.invalidate);
  const materialRef = useRef();
  useEffect(() => {
    if (!activa || datos) return;
    let vigente = true;
    const inicio = performance.now();
    fetch(GAIA_URL)
      .then(respuesta => { if (!respuesta.ok) throw new Error(GAIA_URL); return respuesta.arrayBuffer(); })
      .then(buffer => {
        if (!vigente) return;
        const leidos = leerGaia(buffer);
        const tabla = tablaColores();
        const gv = Float32Array.from({ length: 256 }, (_, k) => tabla[k * 4 + 3]);
        const textura = new THREE.DataTexture(tabla, 256, 1, THREE.RGBAFormat, THREE.FloatType);
        textura.magFilter = textura.minFilter = THREE.NearestFilter;
        textura.needsUpdate = true;
        const geometria = new THREE.BufferGeometry();
        geometria.setAttribute('position', new THREE.BufferAttribute(leidos.posiciones, 3));
        geometria.setAttribute('magnitudByte', new THREE.BufferAttribute(leidos.magnitudes, 1, true));
        geometria.setAttribute('colorByte', new THREE.BufferAttribute(leidos.colores, 1, true));
        // Los atributos ya están en la GPU tras el primer dibujo; no hace falta conservar la copia.
        for (const nombre of ['position', 'magnitudByte', 'colorByte']) geometria.getAttribute(nombre).onUpload(function liberar() { this.array = null; });
        setDatos({ geometria, textura, ...escalasDeGrupo(leidos.magnitudes, leidos.colores, gv), n: leidos.n });
        performance.measure('capa-gaia', { start: inicio, end: performance.now() });
      })
      .catch(error => console.warn('Capa Gaia no disponible:', error.message));
    return () => { vigente = false; };
  }, [activa, datos]);
  useEffect(() => { if (datos) invalidate(); }, [datos, invalidate]);
  useEffect(() => () => { datos?.geometria.dispose(); datos?.textura.dispose(); }, [datos]);

  const uniforms = useMemo(() => ({
    tablaColor: { value: null }, exposure: { value: 0.13 }, pixelRatio: { value: 1 },
    individualMix: { value: 0 }, fisico: { value: 0 }, limite: { value: 6 },
    ganancia: { value: 1 }, tenue: { value: TENUE_MAPA }, areaScale: { value: 1 }, energyScale: { value: 1 }, farCompression: { value: 0 },
  }), []);
  useFrame(({ camera, gl }) => {
    const material = materialRef.current;
    if (!material || !datos) return;
    const u = material.uniforms;
    const distance = Math.hypot(camera.position.x + origin[0], camera.position.y + origin[1], camera.position.z + origin[2]);
    const galaxia = catalogueGalaxyGain(distance);
    u.tablaColor.value = datos.textura;
    u.areaScale.value = datos.areaScale;
    u.energyScale.value = datos.energyScale;
    u.exposure.value = skyExposure(distance, false) * backgroundGain(distance) * gain * Math.max(galaxia, PISO_GALAXIA_MAPA * (1 - smoothRange(distance / LIGHT_YEAR_PC, ...PISO_HASTA_AL)))
      * Math.min(1, (EXTENSION_CAPA_AL * LIGHT_YEAR_PC / distance) ** 2);
    u.pixelRatio.value = gl.getPixelRatio();
    const { fisico, limite } = parametrosBrillo();
    u.fisico.value = fisico;
    u.limite.value = limite;
    u.ganancia.value = gain * galaxia;
    u.individualMix.value = smoothRange(distance, 4, 12);
    u.farCompression.value = THREE.MathUtils.smoothstep(distance, 300, 3000);
  });
  if (!datos) return null;
  // La geometría queda en el marco del catálogo y el grupo se traslada por −origin: la resta se hace en
  // doble precisión al componer las matrices en CPU, como el resto de la escena.
  return (
    <points frustumCulled={false} position={[-origin[0], -origin[1], -origin[2]]} geometry={datos.geometria}>
      <shaderMaterial ref={materialRef} uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader}
        transparent depthWrite={false} depthTest blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  );
}
