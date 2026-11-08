import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, InstancedBufferAttribute, Vector2, Vector3 } from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { mergeTrails } from './fadingTrail';
import { smoothRange } from './scale';

// Estelas que se desvanecen hacia la cola (véase fadingTrail.js), todas en un solo objeto de
// líneas con ancho en píxeles. Con mezcla aditiva, oscurecer el color equivale a hacerlo
// transparente: el desvanecimiento (avance^1,4 · peso) va ya multiplicado en el color de cada
// vértice. Cada estela aparece cuando su tamaño de referencia (`size`, en unidades de escena;
// para una luna, su distancia al planeta) ocupa entre `fadePixels[0]` y `fadePixels[1]` píxeles
// vistos a la distancia del grupo, y se retira si supera `fadeOutPixels` (opcional, por estela).
// Con `fadeDistance` = [lejos, cerca] (unidades de escena, distancia de la cámara al grupo), las
// estelas no se ven más allá de `lejos` y aparecen de forma gradual hasta `cerca`.
// Coordenadas locales del grupo padre.
//
// De cerca de un cuerpo, la estela se dibuja relativa a su cabeza (el cuerpo): en Float32 y relativa
// al planeta, a unos miles de km de una luna el redondeo movía la línea varios km en cada cuadro y,
// al mover la cámara, se veían varias líneas. Se ancla a la cabeza más cercana cuando la cámara está a
// menos de ANCLA_CERCA de su tamaño de referencia (la órbita) y se suelta pasado ANCLA_LEJOS.
const ANCLA_CERCA = 0.5, ANCLA_LEJOS = 0.75;
const center = new Vector3(), local = new Vector3(), canvasSize = new Vector2();
const headOf = trail => Array.from(trail.points.subarray(trail.points.length - 3));

export default function FadingTrails({ trails, fadePixels = [12, 50], opacity = 1, width = 1.6, fadeDistance }) {
  const [anchorIndex, setAnchorIndex] = useState(-1);
  const anchor = useMemo(() => anchorIndex >= 0 && trails[anchorIndex] ? headOf(trails[anchorIndex]) : [0, 0, 0], [trails, anchorIndex]);
  const line = useMemo(() => {
    const merged = mergeTrails(trails, anchor);
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
    // Tamaño aparente y distancia se miden al dibujar, desde el grupo (el planeta), no desde la cabeza
    // de anclaje: al anclarse a una luna lejana la distancia cambiaba de golpe y las estelas se apagaban
    // y volvían; y al cambiar de ancla la línea nueva tenía un primer cuadro sin medir (otro parpadeo).
    material.onBeforeRender = (renderer, scene, camera, geometry, object) => {
      const distance = camera.position.distanceTo((object.parent ?? object).getWorldPosition(center));
      renderer.getSize(canvasSize);
      uniforms.pixelsPerUnit.value = canvasSize.y / (2 * Math.tan(camera.fov * Math.PI / 360)) / distance;
      uniforms.trailOpacity.value = opacity * (fadeDistance ? 1 - smoothRange(distance, fadeDistance[1], fadeDistance[0]) : 1);
    };
    const object = new LineSegments2(geometry, material);
    object.frustumCulled = false;
    object.position.fromArray(anchor);
    object.userData.uniforms = uniforms;
    return object;
  }, [trails, anchor, fadePixels, opacity, width, fadeDistance]);
  useEffect(() => () => { line.geometry.dispose(); line.material.dispose(); }, [line]);
  const ref = useRef();
  useFrame(({ camera }) => {
    const object = ref.current;
    if (object.parent) {
      object.parent.worldToLocal(local.copy(camera.position));
      let best = -1, bestRatio = Infinity;
      trails.forEach((trail, i) => {
        const head = headOf(trail);
        const ratio = Math.hypot(local.x - head[0], local.y - head[1], local.z - head[2]) / trail.size;
        if (ratio < bestRatio) { best = i; bestRatio = ratio; }
      });
      const current = anchorIndex >= 0 && trails[anchorIndex] ? headOf(trails[anchorIndex]) : null;
      const keep = current && Math.hypot(local.x - current[0], local.y - current[1], local.z - current[2]) / trails[anchorIndex].size < ANCLA_LEJOS;
      const next = keep ? anchorIndex : bestRatio < ANCLA_CERCA ? best : -1;
      if (next !== anchorIndex) setAnchorIndex(next);
    }
  });
  return <primitive object={line} ref={ref} />;
}
