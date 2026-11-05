// Genera src/scene/planetEphemeris.json: posiciones heliocéntricas de los ocho planetas (ICRF, centro
// del Sol) de JPL Horizons (data/planets/fuentes/, de fetch_planets.mjs). Se guarda la diferencia con
// la elipse de los elementos medios de solarEphemeris.js, que es pequeña y suave, como ajustes de
// Chebyshev por tramos: cada tramo de `segmentDays` lleva `degree + 1` coeficientes por eje, en km
// enteros. Uso: node scripts/planets/build_planets.js
import fs from 'node:fs';
import path from 'node:path';
import { AU_KM } from '../../src/scene/scale.js';
import { PLANET_SOURCES } from './fetch_planets.mjs';
import { keplerPosition } from '../../src/scene/solarEphemeris.js';
import { AU_TO_PC } from '../../src/scene/scale.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
const OUT = path.join(ROOT, 'src/scene/planetEphemeris.json');
// Longitud de tramo (días) y grado de cada planeta: los más compactos con error bajo 150 km frente a
// Horizons en las muestras del ajuste.
export const FITS = { Mercurio: [128, 16], Venus: [256, 11], Tierra: [512, 15], Marte: [512, 11],
  Júpiter: [1024, 15], Saturno: [1024, 14], Urano: [1024, 14], Neptuno: [1024, 14] };

export function readSource(name) {
  return fs.readFileSync(path.join(ROOT, 'data/planets/fuentes', `${name}.csv`), 'utf8').split('\n')
    .filter(line => /^\d/.test(line)).map(line => line.split(',').map(Number));
}

// Elipse de los elementos medios en km, en el día juliano `jd` (la misma conversión de fecha que la escena).
export const keplerKm = (name, jd) => keplerPosition(name, new Date((jd - 2440587.5) * 86400000)).map(value => value / AU_TO_PC * AU_KM);
// Filas de Horizons como diferencia con la elipse, en UA (para fitPlanet).
export const residualRows = (name, rows) => rows.map(row => { const k = keplerKm(name, row[0]); return [row[0], ...[1, 2, 3].map(i => row[i] - k[i - 1] / AU_KM)]; });

// Polinomios de Chebyshev T0..Tn en x ∈ [-1, 1].
export function chebyshev(x, n) {
  const t = [1, x];
  for (let k = 2; k <= n; k++) t.push(2 * x * t[k - 1] - t[k - 2]);
  return t.slice(0, n + 1);
}

// Mínimos cuadrados por ecuaciones normales (n pequeño), con eliminación de Gauss.
function leastSquares(rows, values, n) {
  const m = n + 1, a = Array.from({ length: m }, () => new Float64Array(m)), b = new Float64Array(m);
  rows.forEach((t, r) => { for (let i = 0; i < m; i++) { b[i] += t[i] * values[r]; for (let j = 0; j < m; j++) a[i][j] += t[i] * t[j]; } });
  for (let c = 0; c < m; c++) {
    let p = c; for (let r = c + 1; r < m; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    [a[c], a[p]] = [a[p], a[c]]; [b[c], b[p]] = [b[p], b[c]];
    for (let r = c + 1; r < m; r++) { const f = a[r][c] / a[c][c]; for (let k = c; k < m; k++) a[r][k] -= f * a[c][k]; b[r] -= f * b[c]; }
  }
  const x = new Float64Array(m);
  for (let r = m - 1; r >= 0; r--) { let s = b[r]; for (let k = r + 1; k < m; k++) s -= a[r][k] * x[k]; x[r] = s / a[r][r]; }
  return x;
}

export function fitPlanet(rows, segmentDays, degree) {
  const startJd = rows[0][0], endJd = rows.at(-1)[0];
  const count = Math.floor((endJd - startJd) / segmentDays);
  const coeffs = [];
  for (let s = 0; s < count; s++) {
    const a = startJd + s * segmentDays, b = a + segmentDays;
    // Con dos muestras más a cada lado: el tramo no queda extrapolado si su borde cae entre muestras.
    const step = rows[1][0] - rows[0][0];
    const inside = rows.filter(row => row[0] >= a - 2 * step - 1e-9 && row[0] <= b + 2 * step + 1e-9);
    const basis = inside.map(row => chebyshev(2 * (row[0] - a) / segmentDays - 1, degree));
    for (let axis = 1; axis <= 3; axis++) coeffs.push(...[...leastSquares(basis, inside.map(row => row[axis] * AU_KM), degree)].map(Math.round));
  }
  return { startJd, segmentDays, degree, segments: count, coeffs };
}

if (import.meta.main ?? process.argv[1] === import.meta.filename) {
  const { planetPositionKm } = await import('../../src/scene/planetEphemerisCore.js');
  const planets = {};
  for (const source of PLANET_SOURCES) {
    const rows = residualRows(source.name, readSource(source.name));
    const fit = fitPlanet(rows, ...FITS[source.name]);
    planets[source.name] = fit;
    let worst = 0;
    for (const row of rows) {
      if (row[0] >= fit.startJd + fit.segments * fit.segmentDays) break;
      const p = planetPositionKm(fit, row[0]);
      worst = Math.max(worst, Math.hypot(p[0] - row[1] * AU_KM, p[1] - row[2] * AU_KM, p[2] - row[3] * AU_KM));
      // (filas y ajuste son diferencias con la elipse: el error es el mismo que en la posición)
    }
    console.log(source.name, fit.segments, 'tramos', fit.coeffs.length, 'coeficientes; error máximo', worst.toFixed(1), 'km');
  }
  fs.writeFileSync(OUT, JSON.stringify({ source: 'https://ssd.jpl.nasa.gov/horizons/', frame: 'ICRF, centro del Sol', units: 'km', planets }));
  const zlib = await import('node:zlib');
  console.log(OUT, fs.statSync(OUT).size, 'bytes;', zlib.gzipSync(fs.readFileSync(OUT)).length, 'comprimido');
}
