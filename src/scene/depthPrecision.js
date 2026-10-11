import { ShaderChunk } from 'three';
import { SCENE_FAR_PC } from './scale.js';

// Three's default log2(1 + depth) rounds to zero at planetary distances in
// parsecs. Scale only the depth encoding, never positions, radii or projection.
const DEPTH_SCALE = 1e12;
const DEPTH_DENOMINATOR = Math.log2(1 + SCENE_FAR_PC * DEPTH_SCALE);

export function encodedDepth(distancePc) {
  return Math.log2(Math.fround(1 + distancePc * DEPTH_SCALE)) / DEPTH_DENOMINATOR;
}

export function installParsecDepthPrecision() {
  // All standard and custom materials include these shared chunks, so the
  // planet surfaces, orbits and distant star points compare the same depths.
  // The denominator is tied to the scene camera's shared SCENE_FAR_PC constant.
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
