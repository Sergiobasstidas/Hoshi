import { ShaderChunk } from 'three';
import { SCENE_FAR_PC } from './scale.js';

// El log2(1 + profundidad) de Three redondea a cero a distancias planetarias en
// parsecs. Escalar solo la codificación de profundidad, no posiciones, radios ni proyección.
const DEPTH_SCALE = 1e12;
const DEPTH_DENOMINATOR = Math.log2(1 + SCENE_FAR_PC * DEPTH_SCALE);

export function encodedDepth(distancePc) {
  return Math.log2(Math.fround(1 + distancePc * DEPTH_SCALE)) / DEPTH_DENOMINATOR;
}

export function installParsecDepthPrecision() {
  // Todos los materiales incluyen estos fragmentos compartidos para comparar
  // las mismas profundidades en superficies planetarias, órbitas y estrellas lejanas.
  // El denominador usa la constante SCENE_FAR_PC compartida con la cámara de escena.
  ShaderChunk.logdepthbuf_vertex = `
    #ifdef USE_LOGARITHMIC_DEPTH_BUFFER
      vFragDepth = 1.0 + gl_Position.w * ${DEPTH_SCALE.toExponential()};
      vIsPerspective = float(isPerspectiveMatrix(projectionMatrix));
    #endif
  `;
  ShaderChunk.logdepthbuf_fragment = `
    #ifdef USE_LOGARITHMIC_DEPTH_BUFFER
      gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z
        : log2(vFragDepth) / ${DEPTH_DENOMINATOR.toPrecision(17)};
    #endif
  `;
}
