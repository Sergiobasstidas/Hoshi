import { AU_TO_PC, orbitalPosition, smoothRange } from './scale.js';
export const KUIPER_VIEW = { id:'kuiper', label:'Kuiper', distance:110*AU_TO_PC };
export const KUIPER_DIM = 0.8;
// Desvanecimiento al alejarse (250–800 UA). Las órbitas de los planetas lo comparten.
export function kuiperFadeOut(pc) {
  return 1 - smoothRange(pc / AU_TO_PC, 250, 800);
}
export function kuiperOpacity(pc) {
  const au = pc / AU_TO_PC;
  // Brillo atenuado un 20 % a cualquier distancia: no se aviva al acercarse (pedido de Sergio, 15/10/2026).
  return .45 * KUIPER_DIM * smoothRange(au,12,35) * kuiperFadeOut(pc);
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
