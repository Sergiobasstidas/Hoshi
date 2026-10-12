import { AU_TO_PC, LIGHT_YEAR_PC, KM_TO_PC, MAX_FLIGHT_SPEED_PC } from './scale.js';
export const VELOCIDAD_MINIMA = 1e-14;
export function velocidadDesdeDial(valor) {
  return VELOCIDAD_MINIMA*(MAX_FLIGHT_SPEED_PC/VELOCIDAD_MINIMA)**(Math.max(0,Math.min(100,valor))/100);
}
export function dialDesdeVelocidad(velocidad) {
  return Math.max(0,Math.min(100,100*Math.log(Math.max(VELOCIDAD_MINIMA,velocidad)/VELOCIDAD_MINIMA)/Math.log(MAX_FLIGHT_SPEED_PC/VELOCIDAD_MINIMA)));
}
export function valorDesdeAngulo(x,y) {
  const angulo=(Math.atan2(y,x)*180/Math.PI-135+360)%360;
  return angulo<=270?angulo/270*100:angulo<315?100:0;
}
export function formatoVelocidad(velocidad) {
  const lejana=velocidad>=.01;
  return {numero:(velocidad/(lejana?LIGHT_YEAR_PC:AU_TO_PC)).toLocaleString('es-CL',{maximumSignificantDigits:3}),
    unidad:lejana?'años luz/s':'UA/s',km:Math.round(velocidad/KM_TO_PC).toLocaleString('es-CL',{maximumFractionDigits:0})};
}
