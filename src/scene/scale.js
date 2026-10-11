// World distances are parsecs. Solar bodies use physical radii; star/probe markers are visual aids.
export const AU_TO_PC = 1 / 206265;
// IAU 2012 AU, as published by JPL: https://ssd.jpl.nasa.gov/astro_par.html
export const AU_KM = 149597870.7;
export const KM_TO_PC = AU_TO_PC / AU_KM;
export const LIGHT_YEAR_PC = 1 / 3.26156;
// c × one day, in the same world units as the solar-system distances.
// Constants: https://ssd.jpl.nasa.gov/astro_par.html
export const LIGHT_DAY_PC = 299792.458 * 86400 * KM_TO_PC;
export const LIGHT_DAY_RULER_LIMIT_PC = 0.02 * LIGHT_YEAR_PC;
export const MAX_VIEW_DISTANCE_PC = 200000 * LIGHT_YEAR_PC;
export const OORT_INNER_PC = 2000 * AU_TO_PC;
export const OORT_OUTER_PC = 100000 * AU_TO_PC;
export const OORT_REVEAL_PC = 0.1 * LIGHT_YEAR_PC;
export const SUN_RADIUS_KM = 695700;
export const SUN_RADIUS_PC = SUN_RADIUS_KM * KM_TO_PC;
export const BODY_CAMERA_NEAR_PC = 1e-14;
export const SCENE_FAR_PC = 400000;

// Camera coordinates are local to the selected destination, never necessarily solar.
export function solarDistance(position, origin) {
  return Math.hypot(position.x + origin[0], position.y + origin[1], position.z + origin[2]);
}

export function smoothRange(value, start, end) {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

export function lightDayRulerOpacity(distancePc, widthPx, availablePx) {
  if (availablePx <= 110 || distancePc >= LIGHT_DAY_RULER_LIMIT_PC) return 0;
  return 0.72 * smoothRange(widthPx, 98, 110)
    * (1 - smoothRange(widthPx, availablePx * 0.8, availablePx))
    * (1 - smoothRange(distancePc, 0.019 * LIGHT_YEAR_PC, LIGHT_DAY_RULER_LIMIT_PC));
}

// One monotonic exposure curve, shared by named and background stars.
// It never reaches zero: zooming through Oort cannot turn off the catalogue.
export function starExposure(distancePc) {
  const logDistance = Math.log10(Math.max(distancePc, 1e-8));
  // Delay the early reveal and cap the distant view to avoid a blown-out centre.
  return 0.13 + 0.40 * smoothRange(logDistance, -2.5, 0)
    + 0.15 * smoothRange(logDistance, 0, 2.5);
}

// Keep the near view intact; reveal the unnamed background as Oort fades out.
export function backgroundGain(distancePc) {
  return 1 + 1.1 * smoothRange(distancePc, 4, 12);
}

// A compressed visual mapping of catalogue absolute magnitude, not a radius
// or a photometric simulation. Lower magnitudes receive more light.
export function stellarVisualWeight(magnitude) {
  const mag = Number.isFinite(magnitude) ? magnitude : 1.3;
  return Math.max(0.45, Math.min(1.5, 2 ** ((1.3 - mag) * 0.15)));
}

export function flightSpeed(distancePc) {
  return Math.max(AU_TO_PC * 0.1, distancePc) * 0.4;
}

// Same wheel response as DESI; speeds here are parsecs per second.
export function wheelSpeed(speed, { deltaY, deltaMode = 0, shiftKey = false }, pageHeight) {
  const delta = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? pageHeight : 1);
  const factor = Math.exp(-Math.max(-100, Math.min(100, delta)) * (shiftKey ? 0.0069 : 0.0005));
  return Math.max(1e-14, Math.min(2000, speed * factor));
}

export function oortOpacity(distancePc) {
  // Begin at 0.1 light years; retain the established ceiling and distant fade.
  return 0.30 * smoothRange(distancePc, OORT_REVEAL_PC, 0.07)
    * (1 - smoothRange(distancePc, 8.5 * LIGHT_YEAR_PC, 16 * LIGHT_YEAR_PC));
}

// Preserve label timing while the dust gains brightness sooner.
export function oortLabelOpacity(distancePc) {
  return 0.30 * smoothRange(distancePc, 0.025, 0.18)
    * (1 - smoothRange(distancePc, 8.5 * LIGHT_YEAR_PC, 16 * LIGHT_YEAR_PC));
}

// Compensate projected particle separation. At 2 ly target 80% of the
// surface brightness at 11 ly, then return to the original distant rendering.
export function oortPointScale(distancePc) {
  // Keep individual points compact during the crossing; no enlarged fuzzy quads.
  return 1 + 0.35 * (1 - smoothRange(distancePc / LIGHT_YEAR_PC, 2, 11));
}

export function starLabelOpacity(distancePc) {
  return smoothRange(distancePc, 0.7, 4) * 0.85
    * (1 - smoothRange(distancePc / LIGHT_YEAR_PC, 650, 700));
}

// NASA Planetary Fact Sheet: mean distance in millions of km / 149.6.
// Circular paths still use mean distances; phases are composed, not ephemerides.
// Individual planes: JPL Table 1, J2000 ecliptic inclination and ascending node.
// https://ssd.jpl.nasa.gov/planets/approx_pos.html
// Earth defines the ecliptic reference (0°), rather than using the table's EM barycentre fit.
export const PLANETS = [
  { name: 'Mercurio', au: 57.9 / 149.6, radiusKm: 2439.4, color: '#b9b6b0', angle: 2.3, inclinationDeg: 7.00497902, ascendingNodeDeg: 48.33076593 },
  { name: 'Venus', au: 108.2 / 149.6, radiusKm: 6051.8, color: '#e1c9a0', angle: 0.7, inclinationDeg: 3.39467605, ascendingNodeDeg: 76.67984255 },
  { name: 'Tierra', au: 1, radiusKm: 6371.0084, color: '#8dc9ef', angle: -0.5, inclinationDeg: 0, ascendingNodeDeg: 0 },
  { name: 'Marte', au: 228 / 149.6, radiusKm: 3389.5, color: '#d58d73', angle: 2.8, inclinationDeg: 1.84969142, ascendingNodeDeg: 49.55953891 },
  { name: 'Júpiter', au: 778.5 / 149.6, radiusKm: 69911, color: '#d5bba0', angle: 0.35, inclinationDeg: 1.30439695, ascendingNodeDeg: 100.47390909 },
  { name: 'Saturno', au: 1432 / 149.6, radiusKm: 58232, color: '#ddd0a4', angle: 2.1, inclinationDeg: 2.48599187, ascendingNodeDeg: 113.66242448 },
  { name: 'Urano', au: 2867 / 149.6, radiusKm: 25362, color: '#a5d4d7', angle: -0.9, inclinationDeg: 0.77263783, ascendingNodeDeg: 74.01692503 },
  { name: 'Neptuno', au: 4515 / 149.6, radiusKm: 24622, color: '#799cdd', angle: -2.6, inclinationDeg: 1.77004347, ascendingNodeDeg: 131.78422574 },
];

// Rotate each orbital plane into the J2000 ecliptic, then into the catalogue's
// equatorial frame. All paths, bodies, labels and focus targets use this transform.
const OBLIQUITY = 23.43928 * Math.PI / 180;
export function orbitalPosition(planet, angle) {
  const radius = planet.au * AU_TO_PC;
  const inclination = planet.inclinationDeg * Math.PI / 180;
  const node = planet.ascendingNodeDeg * Math.PI / 180;
  const x = radius * Math.cos(angle);
  const y = radius * Math.sin(angle);
  const eclipticX = Math.cos(node) * x - Math.sin(node) * Math.cos(inclination) * y;
  const eclipticY = Math.sin(node) * x + Math.cos(node) * Math.cos(inclination) * y;
  const eclipticZ = Math.sin(inclination) * y;
  return [eclipticX,
    eclipticY * Math.cos(OBLIQUITY) - eclipticZ * Math.sin(OBLIQUITY),
    eclipticY * Math.sin(OBLIQUITY) + eclipticZ * Math.cos(OBLIQUITY)];
}

export const VIEWS = [
  { id: 'solar', label: 'Sistema solar', distance: 5 * AU_TO_PC },
  { id: 'oort', label: 'Nube de Oort', distance: 1.05 },
  { id: 'stars', label: 'Vecindario', distance: 65 },
];

// Retained legacy illustrative positions, not current tracking data.
export const PROBES = [
  { name: 'Voyager 1', au: 172, direction: [1, 0.35, -0.2], color: '#81b6bf' },
  { name: 'Voyager 2', au: 143, direction: [-0.7, -0.45, 0.55], color: '#b895b2' },
];
