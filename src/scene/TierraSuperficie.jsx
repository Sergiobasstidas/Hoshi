import { useCallback, useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

// La Tierra en una sola esfera: día con nubes, brillo del Sol en los océanos, luces de ciudades del
// lado de noche y un borde de atmósfera del lado iluminado. Todo se calcula en el marco propio de la
// esfera (radio 1): la normal es la posición, la luz llega como dirección fija hacia el Sol en la fecha
// de carga y la cámara se pasa a ese marco en cada cuadro, en doble precisión, antes de dibujar.
const VERTICES = /* glsl */`
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vPosicion;
varying vec2 vUv;
void main() {
  vPosicion = position;
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}`;

const FRAGMENTOS = /* glsl */`
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D dia;
uniform sampler2D nubes;
uniform sampler2D noche;
uniform sampler2D especular;
uniform vec3 luz;
uniform vec3 camara;
varying vec3 vPosicion;
varying vec2 vUv;
// Misma escala que meshLambertMaterial con la luz puntual (2) del sistema solar; el ambiente queda
// en 0,1 (los demás cuerpos usan 0,35) para que la noche sea oscura y se vean las ciudades.
const float AMBIENTE = 0.1 * RECIPROCAL_PI;
const float SOL = 2.0 * RECIPROCAL_PI;
void main() {
  #include <logdepthbuf_fragment>
  vec3 n = normalize(vPosicion);
  vec3 v = normalize(camara - vPosicion);
  float nl = dot(n, luz);
  float difusa = max(nl, 0.0);
  float cubierta = texture2D(nubes, vUv).r;
  vec3 superficie = mix(texture2D(dia, vUv).rgb, vec3(0.92), cubierta * 0.9);
  // De noche las nubes reciben casi nada del ambiente: apenas se adivinan.
  vec3 color = superficie * (AMBIENTE * (1.0 - 0.85 * cubierta) + SOL * difusa);
  // Reflejo del Sol en el agua: tenue y chico, nunca bajo nubes.
  vec3 h = normalize(luz + v);
  float agua = texture2D(especular, vUv).r * (1.0 - cubierta);
  color += vec3(1.0, 0.95, 0.85) * pow(max(dot(n, h), 0.0), 80.0) * agua * 0.35 * smoothstep(0.0, 0.1, nl);
  // Luces de ciudades: aparecen pasada la línea día/noche, en unos 10° (sin 10° ≈ 0,17).
  float nocturno = 1.0 - smoothstep(-0.17, 0.0, nl);
  color += texture2D(noche, vUv).rgb * 1.5 * (1.0 - cubierta) * nocturno;
  // Borde de atmósfera del lado iluminado.
  float borde = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  color += vec3(0.32, 0.55, 1.0) * borde * 0.45 * smoothstep(-0.1, 0.4, nl);
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}`;

const camaraLocal = new THREE.Vector3();
// Sin nubes, luces ni mapa especular (de lejos o mientras bajan), el sombreador los lee en negro: queda el día solo.
const NEGRO = (() => { const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); t.needsUpdate = true; return t; })();

// `mapas`: urls de día y, si ya corresponden, de nubes, noche y especular; `luz`: dirección hacia el Sol en el
// marco de la esfera.
export default function TierraSuperficie({ mapas, luz }) {
  const gl = useThree(state => state.gl);
  const configurar = useCallback(cargadas => {
    for (const textura of [cargadas].flat()) {
      textura.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
      textura.minFilter = THREE.LinearMipmapLinearFilter;
      textura.magFilter = THREE.LinearFilter;
      textura.needsUpdate = true;
    }
  }, [gl]);
  const texturas = useTexture(mapas, configurar);
  const material = useMemo(() => {
    // Día y noche son color; nubes y especular, datos.
    for (const [clave, textura] of Object.entries(texturas)) {
      const espacio = clave === 'dia' || clave === 'noche' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      if (textura.colorSpace !== espacio) Object.assign(textura, { colorSpace: espacio, needsUpdate: true });
    }
    const nuevo = new THREE.ShaderMaterial({
      uniforms: {
        dia: { value: texturas.dia }, nubes: { value: texturas.nubes ?? NEGRO }, noche: { value: texturas.noche ?? NEGRO },
        especular: { value: texturas.especular ?? NEGRO }, luz: { value: new THREE.Vector3(...luz) }, camara: { value: new THREE.Vector3() },
      },
      vertexShader: VERTICES, fragmentShader: FRAGMENTOS, toneMapped: false,
    });
    nuevo.onBeforeRender = (renderer, scene, camera, geometry, object) => {
      nuevo.uniforms.camara.value.copy(object.worldToLocal(camaraLocal.setFromMatrixPosition(camera.matrixWorld)));
      nuevo.uniformsNeedUpdate = true;
    };
    return nuevo;
  }, [texturas, luz]);
  useEffect(() => () => material.dispose(), [material]);
  return <primitive object={material} attach="material" />;
}
