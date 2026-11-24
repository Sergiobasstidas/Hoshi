// Nubes de Oort de F-07 (rama f7-prototipos): O1 «espiral publicada» y O2 «nube densa sin espiral».
// Posiciones en pc, marco ecuatorial del catálogo, centradas en el Sol.
import { GALACTIC_X, GALACTIC_Y, GALACTIC_Z } from './galaxy.js';
import { AU_TO_PC } from './scale.js';

// Marea galáctica: factores (y, z) respecto del eje x (hacia el centro galáctico) de la superficie equipotencial,
// problema de Hill con A = 15,3 y B = −11,9 km/s/kpc (Bovy 2017) y ρ0 = 0,102 M☉/pc³ (Holmberg y Flynn 2000).
// Radio de marea r_J = 1,37 pc ≈ 283.000 UA. Cálculo propio (ver docs §6).
export const MAREA_OORT = [[50000, 0.997, 0.989], [100000, 0.978, 0.924], [150000, 0.931, 0.812], [200000, 0.850, 0.691]];
export function escalaMarea(rUA) {
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
  const azar = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const gauss = () => Math.sqrt(-2 * Math.log(Math.max(azar(), 1e-12))) * Math.cos(2 * Math.PI * azar());
  // r con dN/dr ∝ r^-1,5 (densidad n ∝ r^-3,5) entre a0 y a1
  const potencia = (a0, a1) => { const u = azar(), p = -0.5; return (a0 ** p + u * (a1 ** p - a0 ** p)) ** (1 / p); };
  return { azar, gauss, potencia };
}
function kepler(a, e, M) {
  let E = M; for (let k = 0; k < 12; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  return [a * (Math.cos(E) - e), a * Math.sqrt(1 - e * e) * Math.sin(E)];
}

// O1 «espiral»: nube interior (80 %) con la espiral de Nesvorný et al. 2025 y nube exterior (20 %) isótropa con marea.
export function generarOortEspiral({ n = 72000, semilla = 1873 } = {}) {
  const { azar, gauss, potencia } = azarConSemilla(semilla);
  const rad = Math.PI / 180;
  const posiciones = new Float32Array(3 * n), radioUA = new Float32Array(n), componente = new Uint8Array(n);
  let k = 0;
  while (k < n) {
    let g, comp;
    if (azar() < 0.8) {
      const a = potencia(1500, 20000);
      if (azar() > suave(a, 1500, 3000)) continue;
      const iso = suave(a, 7000, 15000);
      let iG, OmG, omG, e;
      if (azar() < iso) { iG = Math.acos(2 * azar() - 1); OmG = 2 * Math.PI * azar(); omG = 2 * Math.PI * azar(); e = Math.sqrt(azar()); comp = 1; }
      else {
        iG = (82 + 8 * gauss()) * rad;
        OmG = (186 - 30 * (a / 3000) ** 1.5 + 12 * gauss()) * rad;
        omG = ((azar() < 0.5 ? 160 : 340) + 15 * gauss()) * rad;
        e = 0.70 + 0.25 * azar(); comp = 0;
      }
      const [xp, yp] = kepler(a, e, 2 * Math.PI * azar());
      const cw = Math.cos(omG), sw = Math.sin(omG), ci = Math.cos(iG), si = Math.sin(iG), cO = Math.cos(OmG), sO = Math.sin(OmG);
      const x1 = cw * xp - sw * yp, y1 = sw * xp + cw * yp, y2 = ci * y1, z2 = si * y1;
      g = [cO * x1 - sO * y2, sO * x1 + cO * y2, z2];
    } else {
      const r = potencia(20000, 100000);   // hasta 100.000 UA, como la ficha (el borrador llegaba a 200.000)
      const z = 2 * azar() - 1, f = 2 * Math.PI * azar(), s = Math.sqrt(1 - z * z);
      const [ky, kz] = escalaMarea(r);
      g = [r * s * Math.cos(f), r * s * Math.sin(f) * ky, r * z * kz]; comp = 2;
    }
    const p = aEcuatorial(...g);
    posiciones.set(p.map(v => v * AU_TO_PC), 3 * k);
    radioUA[k] = Math.hypot(...g); componente[k] = comp; k++;
  }
  return { posiciones, radioUA, componente, peso: null };
}

// O2 «bola»: n ∝ r^-3,5 isótropa (Duncan, Quinn y Tremaine 1987), r log-uniforme con peso de brillo ∝ n(r)·r³
// (normalizado a media 1 y recortado a 0,15–3), borde interior suave y caída exterior ilustrativa, misma marea que O1.
export function generarOortBola({ n = 72000, semilla = 1873 } = {}) {
  const { azar } = azarConSemilla(semilla);
  const posiciones = new Float32Array(3 * n), radioUA = new Float32Array(n), peso = new Float32Array(n), componente = new Uint8Array(n);
  const r0 = 2000, r1 = 100000;   // 2.000–100.000 UA, como la ficha
  const bruto = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const r = r0 * (r1 / r0) ** azar();
    const z = 2 * azar() - 1, f = 2 * Math.PI * azar(), s = Math.sqrt(1 - z * z);
    const [ky, kz] = escalaMarea(r);
    const g = [r * s * Math.cos(f), r * s * Math.sin(f) * ky, r * z * kz];
    posiciones.set(aEcuatorial(...g).map(v => v * AU_TO_PC), 3 * k);
    radioUA[k] = r; componente[k] = r < 20000 ? 0 : 2;
    bruto[k] = r ** -0.5 * suave(r, 2000, 3000) * Math.exp(-((r / 90000) ** 2));
  }
  let media = 0; for (const b of bruto) media += b / n;
  for (let k = 0; k < n; k++) peso[k] = Math.min(3, Math.max(0.15, bruto[k] / media));
  return { posiciones, radioUA, componente, peso };
}
