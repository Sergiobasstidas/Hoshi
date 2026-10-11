import { stellarVisualWeight } from './scale.js';

const magnitude = value => Number.isFinite(value) ? value : 1.3;

// Compressed absolute-magnitude encoding for a location marker, NOT a radius.
// A smooth curve avoids giving every luminous star the same clamped diameter.
export function stellarMarkerSize(value) {
  return 0.45 + 1.8 / (1 + Math.exp((magnitude(value) - 1) * 0.5));
}

export function catalogueColor(rgb) {
  if (!Array.isArray(rgb) || rgb.length !== 3 || !rgb.every(Number.isFinite)) return [1, 1, 1];
  return rgb.map(channel => Math.max(0, Math.min(1, channel / 255)));
}

// Preserve the RGB channel order and neutral/unknown white, while making the
// catalogue's warm/cool differences readable. This is an illustrative palette.
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
  // Keep the total nominal sprite area (and fragment workload) unchanged.
  const areaScale = area ? Math.sqrt(stars.length / area) : 1;
  let newEnergy = 0;
  for (let i = 0; i < stars.length; i++) {
    markerSize[i] *= areaScale;
    newEnergy += individualLuminosity[i] * markerSize[i] ** 2;
  }
  // Account for the larger area of larger stars: avoid re-burning the centre.
  const energyScale = newEnergy ? oldEnergy / newEnergy : 1;
  for (let i = 0; i < stars.length; i++) individualLuminosity[i] *= energyScale;
  return { luminosity, individualLuminosity, markerSize, vividColor };
}
