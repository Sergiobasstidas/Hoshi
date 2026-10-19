import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, InstancedBufferAttribute, Vector3 } from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { mergeTrails } from './fadingTrail';

// Estelas que se desvanecen hacia la cola (véase fadingTrail.js), todas en un solo objeto de
// líneas con ancho en píxeles. Con mezcla aditiva, oscurecer el color equivale a hacerlo
// transparente: el desvanecimiento (avance^1,4 · peso) va ya multiplicado en el color de cada
// vértice. Cada estela aparece cuando su tamaño de referencia (`size`, en unidades de escena;
// para una luna, su distancia al planeta) ocupa entre `fadePixels[0]` y `fadePixels[1]` píxeles
// vistos a la distancia del grupo, y se retira si supera `fadeOutPixels` (opcional, por estela).
// Coordenadas locales del grupo padre.
const center = new Vector3();

export default function FadingTrails({ trails, fadePixels = [12, 50], opacity = 1, width = 1.6 }) {
  const line = useMemo(() => {
    const merged = mergeTrails(trails);
    const colors = new Float32Array(merged.color.length);
    merged.progress.forEach((progress, v) => {
      const fade = progress ** 1.4 * merged.weight[v];
      for (let c = 0; c < 3; c++) colors[v * 3 + c] = merged.color[v * 3 + c] * fade;
    });
    const geometry = new LineSegmentsGeometry().setPositions(merged.position).setColors(colors);
    // Un tamaño por segmento (el del primer vértice; ambos son de la misma estela).
    geometry.setAttribute('instanceSize', new InstancedBufferAttribute(merged.size.filter((_, v) => v % 2 === 0), 1));
    geometry.setAttribute('instanceFadeOut', new InstancedBufferAttribute(merged.fadeOut.filter((_, v) => v % 2 === 0).map(value => Math.min(value, 3e38)), 1));
    const uniforms = { pixelsPerUnit: { value: 0 }, fade: { value: fadePixels }, trailOpacity: { value: opacity } };
    const material = new LineMaterial({ vertexColors: true, linewidth: width, transparent: true, depthWrite: false,
      toneMapped: false, blending: AdditiveBlending });
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('attribute vec3 instanceColorEnd;', 'attribute vec3 instanceColorEnd;\nattribute float instanceSize;\nattribute float instanceFadeOut;\nuniform float pixelsPerUnit;\nuniform vec2 fade;\nuniform float trailOpacity;')
        .replace('vColor.xyz = ( position.y < 0.5 ) ? instanceColorStart : instanceColorEnd;',
          'vColor.xyz = ( ( position.y < 0.5 ) ? instanceColorStart : instanceColorEnd ) * trailOpacity * smoothstep( fade.x, fade.y, instanceSize * pixelsPerUnit ) * ( 1.0 - smoothstep( instanceFadeOut, instanceFadeOut * 2.5, instanceSize * pixelsPerUnit ) );')
        // El mismo recorte junto al plano de la cámara que OrbitLine.jsx (plano cercano de 1e-14 pc).
        .replace('float nearEstimate = - 0.5 * b / a;', 'float nearEstimate = min( - 0.5 * b / a, start.z * 0.002 );');
      // Sin remates redondos: con mezcla aditiva se sumaban en cada unión y la estela se veía
      // como una sucesión de puntos (captura de Sergio, 15/10/2026).
      shader.fragmentShader = shader.fragmentShader.replace('#include <clipping_planes_fragment>',
        '#include <clipping_planes_fragment>\n\tif ( abs( vUv.y ) > 1.0 ) discard;');
    };
    material.customProgramCacheKey = () => 'estela-desvanecida';
    const object = new LineSegments2(geometry, material);
    object.frustumCulled = false;
    object.userData.uniforms = uniforms;
    return object;
  }, [trails, fadePixels, opacity, width]);
  useEffect(() => () => { line.geometry.dispose(); line.material.dispose(); }, [line]);
  const ref = useRef();
  useFrame(({ camera, size }) => {
    const object = ref.current;
    const distance = camera.position.distanceTo(object.getWorldPosition(center));
    object.userData.uniforms.pixelsPerUnit.value = size.height / (2 * Math.tan(camera.fov * Math.PI / 360)) / distance;
  });
  return <primitive object={line} ref={ref} />;
}
