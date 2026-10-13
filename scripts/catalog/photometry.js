// scripts/catalog/photometry.js
// Conversiones fotométricas compartidas por los generadores de data/catalog/.

// V de Johnson desde G y BP−RP de Gaia: Riello et al. (2021), tabla C.2,
// G − V = −0,02704 + 0,01424·c − 0,2156·c² + 0,01426·c³ con c = BP−RP (−0,5 < c < 5).
export function vFromGaia(g, bpRp) {
  if (!Number.isFinite(g) || !Number.isFinite(bpRp)) return null;
  return g - (-0.02704 + 0.01424 * bpRp - 0.2156 * bpRp ** 2 + 0.01426 * bpRp ** 3);
}

// Ballesteros (2012): temperatura efectiva desde B−V. Misma fórmula que scripts/process_stars.js.
export const bvToTemperature = bv => 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));

// Inversa numérica de Ballesteros (la función decrece con B−V). Devuelve null fuera
// del intervalo que la fórmula puede representar.
export function temperatureToBv(temperature) {
  let low = -0.4, high = 6;
  if (!Number.isFinite(temperature) || temperature > bvToTemperature(low) || temperature < bvToTemperature(high)) return null;
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    if (bvToTemperature(mid) > temperature) low = mid; else high = mid;
  }
  return Number(((low + high) / 2).toFixed(3));
}

// Tanner Helland: cuerpo negro a sRGB 0-255. Igual que scripts/process_stars.js.
export function temperatureToRgb(temp) {
  const t = temp / 100;
  let r, g, b;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  return [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))));
}
