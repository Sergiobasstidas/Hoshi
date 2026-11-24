import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { UMBRAL_PASE, crearMapaCpu } from './galaxiaModelo.js';
import { composicionFragment, composicionVertex, marchaFragment, marchaVertex } from './galaxiaShaders.js';
import { ANCHO_PLANTA_KPC } from './galaxiaModelo.js';
import mapasEsa from '../f7/mapasEsa.json';
import { crearRuido3D } from './galaxiaRuido.js';
import { dibujarVolumen } from './galaxiaCuadro.js';

// Galaxia de F-07 (opciones A y B, rama f7-prototipos): un volumen trazado por rayos en un render target de menor
// resolución (galaxiaShaders.js, marchaFragment) que se compone en la pantalla antes que todo lo demás (renderOrder −1000,
// sin profundidad): las estrellas se suman encima y los cuerpos opacos la tapan. Todo depende solo de la pose de la cámara.
const D2R = Math.PI / 180;
const ARCHIVOS = {
  a: { emision: '/textures/galaxy/gaia-milky-way-2025.jpg', polvo: '/textures/galaxy/f7-esa-polvo.png', ladoE: 2048, ladoP: 1024 },
  b: { emision: '/textures/galaxy/f7-modelo-emision.png', polvo: '/textures/galaxy/f7-modelo-polvo.png', ladoE: 1024, ladoP: 512 },
};
const cargarImagen = url => new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = url; });
const pixeles = (imagen, n) => { const c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'); g.drawImage(imagen, 0, 0, n, n); return g.getImageData(0, 0, n, n).data; };

export default function GalaxiaVolumen({ variante, origin, opacidad, escalaE = 1, barraGrados = mapasEsa.barraGrados }) {
  const { gl } = useThree();
  const [recursos, setRecursos] = useState(null);
  const compuesto = useRef();
  useEffect(() => {
    let activo = true;
    const { emision, polvo } = ARCHIVOS[variante];
    Promise.all([cargarImagen(emision), cargarImagen(polvo)]).then(([ie, ip]) => {
      if (!activo) return;
      const textura = (imagen, srgb) => {
        const t = new THREE.Texture(imagen);
        t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
        t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 4; t.needsUpdate = true;
        return t;
      };
      // Copias de 256² en la CPU para el punto negro (brillo del cielo hacia los polos desde dentro del disco).
      const mapa = crearMapaCpu({ emision: pixeles(ie, 256), polvo: pixeles(ip, 256), n: 256, modeloB: variante === 'b', escalaE });
      setRecursos({ emision: textura(ie, true), polvo: textura(ip, false), mapa, ruido: variante === 'b' ? crearRuido3D(64) : null });
    }).catch(error => console.warn('Galaxia F-07 no disponible:', error));
    return () => { activo = false; };
  }, [variante, escalaE]);
  useEffect(() => () => { recursos?.emision.dispose(); recursos?.polvo.dispose(); recursos?.ruido?.dispose(); }, [recursos]);
  const objetivo = useMemo(() => new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }), []);
  useEffect(() => () => objetivo.dispose(), [objetivo]);
  const marcha = useMemo(() => {
    const escena = new THREE.Scene(), camara = new THREE.Camera();
    const geometria = new THREE.BufferGeometry();
    geometria.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const material = new THREE.ShaderMaterial({
      vertexShader: marchaVertex, fragmentShader: marchaFragment, depthTest: false, depthWrite: false,
      uniforms: {
        uCam: { value: new THREE.Vector3() }, uRayos: { value: new THREE.Matrix3() }, uTan: { value: new THREE.Vector2() }, uPixAng: { value: 0 },
        uEmision: { value: null }, uPolvo: { value: null }, uRuido: { value: null },
        uTexelE: { value: ANCHO_PLANTA_KPC / ARCHIVOS[variante].ladoE }, uTexelP: { value: ANCHO_PLANTA_KPC / ARCHIVOS[variante].ladoP },
        uEscalaE: { value: escalaE }, uBarra: { value: barraGrados * D2R }, uModeloB: { value: variante === 'b' ? 1 : 0 },
        uGrumos: { value: variante === 'b' ? 1 : 0 }, uLuz: { value: 1 }, uDh: { value: 1 }, uPasosMax: { value: 48 },
        uJitter: { value: 1 }, uExpo: { value: 1 }, uNegro: { value: 0 }, uInterior: { value: 0 },
      },
    });
    const malla = new THREE.Mesh(geometria, material);
    malla.frustumCulled = false;
    escena.add(malla);
    return { escena, camara, material, geometria };
  }, [variante, escalaE, barraGrados]);
  useEffect(() => () => { marcha.material.dispose(); marcha.geometria.dispose(); }, [marcha]);
  const uniformesCompuesto = useMemo(() => ({ uImagen: { value: objetivo.texture }, uLienzo: { value: new THREE.Vector2(1, 1) }, uEscala: { value: 1 }, uOpacidad: { value: 0 } }), [objetivo]);
  const tamano = useMemo(() => new THREE.Vector2(), []);
  useFrame(({ camera }) => {
    const malla = compuesto.current;
    if (!malla) return;
    const alfa = opacidad.current;
    malla.visible = Boolean(recursos) && alfa > UMBRAL_PASE;
    if (!malla.visible) return;
    dibujarVolumen({ gl, camera, origin, marcha, objetivo, recursos, malla, alfa, tamano, barra: barraGrados * D2R });
  });
  return <mesh ref={compuesto} renderOrder={-1000} frustumCulled={false}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3]} /></bufferGeometry>
    <shaderMaterial uniforms={uniformesCompuesto} vertexShader={composicionVertex} fragmentShader={composicionFragment}
      depthTest={false} depthWrite={false} transparent={false} blending={THREE.CustomBlending}
      blendSrc={THREE.OneFactor} blendDst={THREE.OneMinusSrcAlphaFactor} toneMapped={false} />
  </mesh>;
}
