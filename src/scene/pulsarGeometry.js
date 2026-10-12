import { PULSARS } from './pulsarData.js';
export function pulsarGeometry(origin) {
  const lines=[], dashes=[], points=[...origin.map(v=>-v)];
  for (const pulsar of PULSARS) {
    const p=pulsar.position;
    lines.push(...origin.map(v=>-v),...p.map((v,i)=>v-origin[i]));
    points.push(...p.map((v,i)=>v-origin[i]));
    // Destellos discontinuos decorativos, no una codificación binaria inventada del período.
    for(let j=0;j<24;j++) {
      const t=0.56+j*0.016;
      dashes.push(...p.map((v,i)=>v*t-origin[i]),...p.map((v,i)=>v*(t+0.006)-origin[i]));
    }
  }
  return {lines:new Float32Array(lines),dashes:new Float32Array(dashes),points:new Float32Array(points)};
}

