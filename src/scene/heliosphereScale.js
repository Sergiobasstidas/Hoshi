import { AU_TO_PC, LIGHT_YEAR_PC, smoothRange } from './scale.js';

// Approximate Voyager crossing scale; the sphere is an illustrative envelope,
// not a measured spherical boundary. Source and limitations: docs/HELIOSPHERE.md.
export const HELIOSPHERE_RADIUS_AU = 120;
export const HELIOSPHERE_RADIUS_PC = HELIOSPHERE_RADIUS_AU * AU_TO_PC;
export const HELIOSPHERE_VIEW_DISTANCE_PC = 320 * AU_TO_PC;
export const HELIOSPHERE_FADE_START_PC = 0.12 * LIGHT_YEAR_PC;
export const HELIOSPHERE_HIDE_PC = 0.15 * LIGHT_YEAR_PC;
export const HELIOSPHERE_BRIGHTNESS = 0.7 * 0.85;

export function probeVisibility(distancePc) {
  return smoothRange(distancePc / AU_TO_PC, 100, 155)
    * (1 - smoothRange(distancePc, 0.019 * LIGHT_YEAR_PC, 0.02 * LIGHT_YEAR_PC));
}

export function heliosphereVisibility(distancePc) {
  const au = distancePc / AU_TO_PC;
  return smoothRange(au, 100, 155)
    * (1 - smoothRange(distancePc, HELIOSPHERE_FADE_START_PC, HELIOSPHERE_HIDE_PC));
}
