// Evaluación de los ajustes de Chebyshev de planetEphemeris.json (scripts/planets/build_planets.js).
// Posición heliocéntrica en km (ICRF) en el día juliano `jd` (TDB); fuera del intervalo, el extremo.
export function planetPositionKm(fit, jd) {
  const span = fit.segments * fit.segmentDays;
  const t = Math.min(Math.max(jd - fit.startJd, 0), span);
  const s = Math.min(Math.floor(t / fit.segmentDays), fit.segments - 1);
  const x = 2 * (t - s * fit.segmentDays) / fit.segmentDays - 1;
  const n = fit.degree + 1, base = s * 3 * n;
  const result = [0, 0, 0];
  for (let axis = 0; axis < 3; axis++) {
    // Recurrencia de Clenshaw.
    let b1 = 0, b2 = 0;
    for (let k = n - 1; k >= 1; k--) { const b0 = 2 * x * b1 - b2 + fit.coeffs[base + axis * n + k]; b2 = b1; b1 = b0; }
    result[axis] = x * b1 - b2 + fit.coeffs[base + axis * n];
  }
  return result;
}
