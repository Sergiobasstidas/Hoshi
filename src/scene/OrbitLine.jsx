import { useEffect, useMemo } from 'react';
import { AdditiveBlending } from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

// Línea de órbita de planetas en azul oscuro. Es un estilo de presentación: ni el ancho ni
// el brillo representan nada físico. Dos variantes:
// · `halo` (exoplanetas): trazo fino y un halo ancho a los lados.
// · `fina` (sistema solar): una sola franja muy delgada y difuminada, con la mitad de brillo.
export const ORBIT_LINE_COLOR = '#2b47c9';
// La banda se dibuja con perfil propio: `vUv.x` va de −1 a 1 a lo ancho. Sin remates en
// los extremos de cada tramo, que al sumarse dejarían cuentas brillantes en las uniones.
const STYLES = {
  // Ancho total en píxeles; el trazo central ocupa alrededor de 1,5 px.
  halo: { width: 22, profile: `
  if (abs(vUv.y) > 1.0) discard;
  float across = abs(vUv.x);
  float core = 1.0 - smoothstep(0.035, 0.10, across);
  float halo = exp(-across * across * 9.0) * (1.0 - smoothstep(0.6, 1.0, across));
  gl_FragColor = vec4(diffuseColor.rgb, alpha * (0.30 * core + 0.17 * halo));` },
  // Gaussiana de ≈ 1,6 px a media altura, sin borde: la línea se funde con el fondo.
  fina: { width: 6, profile: `
  if (abs(vUv.y) > 1.0) discard;
  float across = abs(vUv.x);
  gl_FragColor = vec4(diffuseColor.rgb, alpha * 0.24 * exp(-across * across * 6.0) * (1.0 - smoothstep(0.8, 1.0, across)));` },
};

// Con el plano cercano de la escena (1e-14 pc), el recorte original deja tramos que cruzan
// el plano de la cámara con un extremo a millones de píxeles, y la banda pierde su ancho.
// Se recorta a 1/500 de la profundidad del extremo visible: lo descartado cae fuera de pantalla.
const withProfile = profile => shader => {
  shader.vertexShader = shader.vertexShader.replace('float nearEstimate = - 0.5 * b / a;',
    'float nearEstimate = min( - 0.5 * b / a, start.z * 0.002 );');
  shader.fragmentShader = shader.fragmentShader.replace('gl_FragColor = vec4( diffuseColor.rgb, alpha );', profile);
};

// El objeto devuelto por `ref` es la línea: `material.opacity` y `visible` se ajustan fuera.
export default function OrbitLine({ points, ref, variant = 'halo' }) {
  const line = useMemo(() => {
    const style = STYLES[variant];
    const material = new LineMaterial({ color: ORBIT_LINE_COLOR, linewidth: style.width, transparent: true, opacity: 0,
      depthWrite: false, toneMapped: false, blending: AdditiveBlending });
    material.onBeforeCompile = withProfile(style.profile);
    material.customProgramCacheKey = () => `orbita-${variant}`;
    const object = new Line2(new LineGeometry().setPositions(points), material);
    object.frustumCulled = false;
    return object;
  }, [points, variant]);
  useEffect(() => () => { line.geometry.dispose(); line.material.dispose(); }, [line]);
  return <primitive object={line} ref={ref} />;
}
