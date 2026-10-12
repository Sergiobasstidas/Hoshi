import { stellarVisualWeight } from './scale.js';

const magnitude = value => Number.isFinite(value) ? value : 1.3;

// Magnitud absoluta comprimida para un marcador de ubicación, NO para un radio.
// Una curva suave evita asignar el mismo diámetro límite a todas las estrellas luminosas.
export function stellarMarkerSize(value) {
  return 0.45 + 1.8 / (1 + Math.exp((magnitude(value) - 1) * 0.5));
}

export function catalogueColor(rgb) {
  if (!Array.isArray(rgb) || rgb.length !== 3 || !rgb.every(Number.isFinite)) return [1, 1, 1];
  return rgb.map(channel => Math.max(0, Math.min(1, channel / 255)));
}

// Conservar el orden RGB y el blanco neutro/desconocido, haciendo visibles
// las diferencias cálidas/frías del catálogo. Es una paleta ilustrativa.
export function vividStellarColor(rgb) {
  return catalogueColor(rgb).map(channel => channel ** 2.1);
}

export function buildStellarAppearance(stars) {
  const luminosity = new Float32Array(stars.length);
  const individualLuminosity = new Float32Array(stars.length);
  const markerSize = new Float32Array(stars.length);
  const vividColor = new Float32Array(stars.length * 3);
  let area = 0, oldEnergy = 0;
  stars.forEach((star, i) => {
    luminosity[i] = Math.max(0.65, Math.min(1.15, 1 - magnitude(star.m) * 0.018));
    individualLuminosity[i] = stellarVisualWeight(star.m);
    markerSize[i] = stellarMarkerSize(star.m);
    vividColor.set(vividStellarColor(star.rgb), i * 3);
    area += markerSize[i] ** 2;
    oldEnergy += luminosity[i];
  });
  // Mantener el área nominal total de los marcadores y la carga de fragmentos.
  const areaScale = area ? Math.sqrt(stars.length / area) : 1;
  let newEnergy = 0;
  for (let i = 0; i < stars.length; i++) {
    markerSize[i] *= areaScale;
    newEnergy += individualLuminosity[i] * markerSize[i] ** 2;
  }
  // Compensar el área de las estrellas mayores para evitar saturar el centro.
  const energyScale = newEnergy ? oldEnergy / newEnergy : 1;
  for (let i = 0; i < stars.length; i++) individualLuminosity[i] *= energyScale;
  return { luminosity, individualLuminosity, markerSize, vividColor };
}
