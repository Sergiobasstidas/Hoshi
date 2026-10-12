import { SUN_RADIUS_KM, KM_TO_PC } from './scale.js';

export const SOLAR_TEMPERATURE_K = 5772;
export const STELLAR_TEXTURE = '/textures/solar-system-scope/2k_sun.jpg';

// Flower (1996), coeficientes corregidos: Torres (2010), tabla 1.
// No válido para enanas M, estrellas WR, de carbono o sistemas sin resolver.
export function bolometricCorrection(temperature) {
  const x = Math.log10(temperature);
  const coefficients = x < 3.7
    ? [-19053.7291496456, 15514.4866764412, -4212.78819301717, 381.476328422343]
    : x < 3.9
      ? [-37051.0203809015, 38567.2629965804, -15065.1486316025, 2617.24637119416, -170.623810323864]
      : [-118115.450538963, 137145.973583929, -63623.3812100225, 14741.2923562646, -1705.87278406872, 78.873172180499];
  return coefficients.reduceRight((sum, value) => sum * x + value, 0);
}

export function radiusFromLuminosity(luminositySolar, temperatureK) {
  if (!(luminositySolar > 0) || !(temperatureK > 0)
      || !Number.isFinite(luminositySolar) || !Number.isFinite(temperatureK)) return null;
  return Math.sqrt(luminositySolar) * (SOLAR_TEMPERATURE_K / temperatureK) ** 2;
}

// sRGB aproximado de cuerpo negro, compartido con la paleta de temperatura del catálogo.
export function temperatureColor(temperature) {
  const t = Math.max(1000, Math.min(40000, temperature)) / 100;
  const rgb = t <= 66
    ? [255, 99.4708025861 * Math.log(t) - 161.1195681661,
      t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307]
    : [329.698727446 * (t - 60) ** -0.1332047592,
      288.1221695283 * (t - 60) ** -0.0755148492, 255];
  return rgb.map(v => Math.max(0, Math.min(1, v / 255)));
}

export function estimateStellarPhysics(record) {
  const bv = record?.bv, mv = record?.mv, spectrum = record?.spectrum?.trim() || '';
  if (!Number.isFinite(bv) || !Number.isFinite(mv) || bv < -0.3 || bv > 1.5
      || !/^[BAFGK]/.test(spectrum) || spectrum.includes('+') || /sd|pec/i.test(spectrum)) return null;
  const temperatureK = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
  if (temperatureK < 4000 || temperatureK > 30000) return null;
  // La calibración solar diferencial mantiene coherente el punto cero de Flower.
  const solarBolometric = 4.81 + bolometricCorrection(SOLAR_TEMPERATURE_K);
  const luminositySolar = 10 ** (0.4 * (solarBolometric - mv - bolometricCorrection(temperatureK)));
  const radiusSolar = radiusFromLuminosity(luminositySolar, temperatureK);
  // Rechazar estimaciones inverosímiles; no ajustarlas silenciosamente a tamaños inventados.
  if (!(radiusSolar >= 0.01 && radiusSolar <= 2000)) return null;
  return { temperatureK, luminositySolar, radiusSolar,
    radiusKm: radiusSolar * SUN_RADIUS_KM, radiusPc: radiusSolar * SUN_RADIUS_KM * KM_TO_PC,
    status: 'estimated', source: 'https://arxiv.org/abs/1008.3913' };
}

export function stellarStopDistance(physics) {
  return physics ? physics.radiusPc * 1.15 : null;
}
