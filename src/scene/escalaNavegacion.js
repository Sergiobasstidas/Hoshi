import { Vector3 } from 'three';
import { AU_TO_PC, LIGHT_YEAR_PC, MAX_VIEW_DISTANCE_PC, KM_TO_PC } from './scale.js';
import { SOLAR_BODIES } from './solarBodies.js';
import { galaxyView } from './galaxy.js';

export const TIERRA = SOLAR_BODIES.find(cuerpo => cuerpo.name === 'Tierra');
export const DISTANCIA_MINIMA = TIERRA.radiusKm * KM_TO_PC * 6;
// Deja margen para que el límite heliocéntrico también se respete al centrar Tierra.
export const DISTANCIA_MAXIMA = MAX_VIEW_DISTANCE_PC - Math.hypot(...TIERRA.position);
// Escala de exploración por tramos: el entorno solar ocupa el tercio inferior.
// Cada tramo conserva distancias continuas, pero no una proporción física uniforme.
export const MARCAS_ESCALA = [
  ['Tierra', 0, DISTANCIA_MINIMA],
  ['Cinturón de Kuiper', 12, 40 * AU_TO_PC],
  ['Heliosfera', 21, 120 * AU_TO_PC],
  ['Nube de Oort', 32, LIGHT_YEAR_PC],
  ['Vía Láctea', 100, DISTANCIA_MAXIMA],
];
export function distanciaDesdeBarra(valor) {
  const v = Math.max(0, Math.min(100, valor));
  const i = Math.max(1, MARCAS_ESCALA.findIndex(marca => marca[1] >= v));
  const [, inicio, cerca] = MARCAS_ESCALA[i - 1], [, fin, lejos] = MARCAS_ESCALA[i];
  return cerca * (lejos / cerca) ** ((v - inicio) / (fin - inicio));
}
export function barraDesdeDistancia(distancia) {
  const d = Math.max(DISTANCIA_MINIMA, Math.min(DISTANCIA_MAXIMA, distancia));
  const i = Math.max(1, MARCAS_ESCALA.findIndex(marca => marca[2] >= d));
  const [, inicio, cerca] = MARCAS_ESCALA[i - 1], [, fin, lejos] = MARCAS_ESCALA[i];
  return inicio + (fin - inicio) * Math.log(d / cerca) / Math.log(lejos / cerca);
}
export function textoDistancia(distancia) {
  const esUA = distancia < 1000 * AU_TO_PC;
  return `${(distancia / (esUA ? AU_TO_PC : LIGHT_YEAR_PC)).toLocaleString('es-CL', {maximumSignificantDigits:3})} ${esUA ? 'UA' : 'años luz'}`;
}
export function destinoDesdeBarra(valor, posicion, origen) {
  const direccion = new Vector3(...posicion).add(new Vector3(...origen)).sub(new Vector3(...TIERRA.position));
  if (direccion.lengthSq() < 1e-24) direccion.set(0, 0, 1);
  // El extremo exterior siempre encuadra la galaxia; las escalas intermedias
  // conservan el lado de aproximación que escogió el usuario.
  if (valor >= 99.9) direccion.fromArray(galaxyView().direction);
  return {id:'escala', target:TIERRA.position, distance:distanciaDesdeBarra(valor),
    minDistance:TIERRA.radiusKm*KM_TO_PC*1.02, direction:direccion.normalize().toArray()};
}
