import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ANCHO_PLANTA_KPC, anillosPlanta, crearMapaCpu } from './galaxiaModelo.js';
import { composicionFragment, composicionVertex, marchaFragment, marchaVertex } from './galaxiaShaders.js';
import { crearRuido3D } from './galaxiaRuido.js';
import { dibujarVolumen } from './galaxiaCuadro.js';
import { mantenerActivo } from './reposo';

// Volumen de la galaxia: el modelo publicado (galaxiaMedida.js, horneado en las texturas galaxia-*.png) trazado por rayos en
// un render target de menor resolución (galaxiaShaders.js, marchaFragment) que se compone en la pantalla antes que todo lo
// demás (renderOrder −1000, sin profundidad): las estrellas se suman encima y los cuerpos opacos la tapan. Todo depende solo
// de la pose de la cámara.
const D2R = Math.PI / 180;
const ARCHIVOS = { emision: '/textures/galaxy/galaxia-emision.png', polvo: '/textures/galaxy/galaxia-polvo.png', ladoE: 2048, ladoP: 1024 };
// Triángulo que cubre la pantalla (composición); constante para no crear un atributo nuevo en cada render de React.
const TRIANGULO = [new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3];
const cargarImagen = url => new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = url; });
const pixeles = (imagen, n) => { const c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'); g.drawImage(imagen, 0, 0, n, n); return g.getImageData(0, 0, n, n).data; };

// Textura de anillos: 128 × 2 en media precisión, filtrado lineal.
function texturaAnillos({ datos, n }) {
  const medios = new Uint16Array(datos.length);
  for (let i = 0; i < datos.length; i++) medios[i] = THREE.DataUtils.toHalfFloat(datos[i]);
  const t = new THREE.DataTexture(medios, n, 2, THREE.RGBAFormat, THREE.HalfFloatType);
  t.minFilter = t.magFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
  return t;
}

// cruce: ref con { W, sinBrazos, fuerzaCerca } (MilkyWay.jsx); umbral: opacidad bajo la cual no se marcha ni se compone.
// listoRef: ref que pasa a true cuando las texturas cargaron (y a false si fallan o el componente se desmonta): mientras no lo
// esté, MilkyWay sigue mostrando la imagen plana también dentro del disco.
export default function GalaxiaVolumen({ origin, opacidad, escalaE, barraGrados, cruce, umbral, listoRef }) {
  const { gl, invalidate } = useThree();
  const [recursos, setRecursos] = useState(null);
  const compuesto = useRef();
  useEffect(() => {
    let activo = true;
    const { emision, polvo } = ARCHIVOS;
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
      const copia = { emision: pixeles(ie, 256), polvo: pixeles(ip, 256), n: 256 };
      const mapa = crearMapaCpu({ ...copia, escalaE });
      const anillos = anillosPlanta(copia);
      setRecursos({ emision: textura(ie, true), polvo: textura(ip, false), mapa, copia, anillos, texAnillos: texturaAnillos(anillos), escalaE,
        ruido: crearRuido3D(64) });
    }).catch(error => { listoRef.current = false; console.warn('Volumen de la galaxia no disponible:', error); });
    return () => { activo = false; };
  }, [escalaE, listoRef]);
  useEffect(() => {
    if (!recursos) return undefined;
    listoRef.current = true;
    mantenerActivo();
    invalidate();
    return () => { listoRef.current = false; };
  }, [recursos, listoRef, invalidate]);
  useEffect(() => () => { recursos?.emision.dispose(); recursos?.polvo.dispose(); recursos?.ruido.dispose(); recursos?.texAnillos.dispose(); }, [recursos]);
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
        uTexelE: { value: ANCHO_PLANTA_KPC / ARCHIVOS.ladoE }, uTexelP: { value: ANCHO_PLANTA_KPC / ARCHIVOS.ladoP },
        uEscalaE: { value: escalaE }, uBarra: { value: barraGrados * D2R },
        uDh: { value: 1 }, uPasosMax: { value: 48 },
        uJitter: { value: 1 }, uExpo: { value: 1 }, uNegro: { value: 0 }, uInterior: { value: 0 },
        uAnillos: { value: null }, uSinBrazos: { value: 0 }, uCercaFuerza: { value: 1 },
      },
    });
    const malla = new THREE.Mesh(geometria, material);
    malla.frustumCulled = false;
    escena.add(malla);
    return { escena, camara, material, geometria };
  }, [escalaE, barraGrados]);
  useEffect(() => () => { marcha.material.dispose(); marcha.geometria.dispose(); }, [marcha]);
  const uniformesCompuesto = useMemo(() => ({ uImagen: { value: objetivo.texture }, uLienzo: { value: new THREE.Vector2(1, 1) }, uEscala: { value: new THREE.Vector2(1, 1) }, uOpacidad: { value: 0 } }), [objetivo]);
  const tamano = useMemo(() => new THREE.Vector2(), []);
  useFrame(({ camera }) => {
    const malla = compuesto.current;
    if (!malla) return;
    const alfa = opacidad.current;
    malla.visible = Boolean(recursos) && alfa > umbral;
    if (!malla.visible) return;
    dibujarVolumen({ gl, camera, origin, marcha, objetivo, recursos, malla, alfa, tamano, barra: barraGrados * D2R, cruce: cruce.current });
  });
  return <mesh ref={compuesto} renderOrder={-1000} frustumCulled={false}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={TRIANGULO} /></bufferGeometry>
    <shaderMaterial uniforms={uniformesCompuesto} vertexShader={composicionVertex} fragmentShader={composicionFragment}
      depthTest={false} depthWrite={false} transparent={false} blending={THREE.CustomBlending}
      blendSrc={THREE.OneFactor} blendDst={THREE.OneMinusSrcAlphaFactor} toneMapped={false} />
  </mesh>;
}
