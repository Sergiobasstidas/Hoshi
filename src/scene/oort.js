// Nube de Oort: nube densa sin espiral, de 2.000 a 100.000 UA. Posiciones en pc, marco ecuatorial del catálogo, centradas en el Sol.
import { GALACTIC_X, GALACTIC_Y, GALACTIC_Z } from './galaxy.js';
import { AU_TO_PC } from './scale.js';

// Marea galáctica: factores (y, z) respecto del eje x (hacia el centro galáctico) de la superficie equipotencial,
// problema de Hill con A = 15,3 y B = −11,9 km/s/kpc (Bovy 2017) y ρ0 = 0,102 M☉/pc³ (Holmberg y Flynn 2000).
// Radio de marea r_J = 1,37 pc ≈ 283.000 UA. Cálculo propio (docs/DOCUMENTACION.md, «Nube de Oort»).
const MAREA_OORT = [[50000, 0.997, 0.989], [100000, 0.978, 0.924], [150000, 0.931, 0.812], [200000, 0.850, 0.691]];
function escalaMarea(rUA) {
  const T = MAREA_OORT;
  if (rUA <= T[0][0]) return [1, 1];
  for (let k = 1; k < T.length; k++) if (rUA <= T[k][0]) {
    const [r0, y0, z0] = T[k - 1], [r1, y1, z1] = T[k], t = (rUA - r0) / (r1 - r0);
    return [y0 + (y1 - y0) * t, z0 + (z1 - z0) * t];
  }
  return [T.at(-1)[1], T.at(-1)[2]];
}
const aEcuatorial = (x, y, z) => [0, 1, 2].map(i => GALACTIC_X[i] * x + GALACTIC_Y[i] * y + GALACTIC_Z[i] * z);
const suave = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function azarConSemilla(semilla) {
  let s = semilla >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

// n ∝ r^-3,5 isótropa (Duncan, Quinn y Tremaine 1987), r log-uniforme con peso de brillo ∝ n(r)·r³ (normalizado a media 1
// y recortado a 0,15–3), borde interior suave y caída exterior ilustrativa, aplanada por la marea galáctica.
export function generarOortBola({ n = 72000, semilla = 1873 } = {}) {
  const azar = azarConSemilla(semilla);
  const posiciones = new Float32Array(3 * n), radioUA = new Float32Array(n), peso = new Float32Array(n);
  const r0 = 2000, r1 = 100000;   // 2.000–100.000 UA, como la ficha
  const bruto = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const r = r0 * (r1 / r0) ** azar();
    const z = 2 * azar() - 1, f = 2 * Math.PI * azar(), s = Math.sqrt(1 - z * z);
    const [ky, kz] = escalaMarea(r);
    const g = [r * s * Math.cos(f), r * s * Math.sin(f) * ky, r * z * kz];
    posiciones.set(aEcuatorial(...g).map(v => v * AU_TO_PC), 3 * k);
    radioUA[k] = r;
    bruto[k] = r ** -0.5 * suave(r, 2000, 3000) * Math.exp(-((r / 90000) ** 2));
  }
  let media = 0; for (const b of bruto) media += b / n;
  for (let k = 0; k < n; k++) peso[k] = Math.min(3, Math.max(0.15, bruto[k] / media));
  return { posiciones, radioUA, peso };
}
