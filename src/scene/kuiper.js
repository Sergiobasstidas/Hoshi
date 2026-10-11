import { AU_TO_PC, orbitalPosition, smoothRange } from './scale.js';
export const KUIPER_VIEW = { id:'kuiper', label:'Kuiper', distance:110*AU_TO_PC };
export function kuiperOpacity(pc) {
  const au = pc / AU_TO_PC;
  const heliosphereDim = 1 - 0.2 * smoothRange(au, 100, 155);
  return .45 * smoothRange(au,12,35) * (1-smoothRange(au,250,800)) * heliosphereDim;
}
export function buildKuiperPositions(count=22000) {
  let seed=30750;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const positions=new Float32Array(count*3);
  for(let i=0;i<count;i++) {
    const au=Math.sqrt(30**2+random()*(50**2-30**2));
    const inclinationDeg=(random()<.85?5:18)*random();
    positions.set(orbitalPosition({au,inclinationDeg,ascendingNodeDeg:random()*360},random()*Math.PI*2),i*3);
  }
  return positions;
}
