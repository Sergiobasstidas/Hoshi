// src/scene/galaxiaModeloB.js (rama f7-prototipos): opción B, «la galaxia medida». Funciones puras en kpc, marco galactocéntrico
// de Hoshi (x del Sol al centro, y giro, z polo norte). Lo usan scripts/f7/hornear-modelo.mjs, el sombreador (hPolvoModelo) y las pruebas.
export const D2R = Math.PI / 180;
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// Bland-Hawthorn y Gerhard 2016 (ARA&A 54, 529; BHG16), discos. Υ_V (masa/luz) ilustrativa.
export const FINO = { M: 3.5e10, Rd: 2.6, U: 1.5, temperatura: 5000 };   // 5.000 K: color integrado ≈ 5.000 K (Licquia et al. 2015, g − r = 0,68)
export const GRUESO = { M: 6e9, Rd: 2.0, U: 3.0, temperatura: 4900 };
// Bulbo b/p (Wegg y Gerhard 2013, MNRAS 435, 1874): eje a 27° (extremo cercano en l > 0), escalas 0,70 : 0,44 : 0,18 kpc,
// brazos de la X a 1,5 kpc; M = 1,55e10 M☉ (BHG16: 1,4–1,7e10). Borde suave (no la caja dura de la sonda).
export const BULBO = { angulo: -27, ax: 0.70, ay: 0.44, az: 0.18, xX: 1.5, caja: [2.2, 1.4], suavidad: 0.5, M: 1.55e10, U: 3.0, temperatura: 4300 };
// Barra larga (Wegg, Gerhard y Portail 2015, MNRAS 450, 4050): semilongitud 5,0 kpc a 28°, ~1e10 M☉ (fina 180 pc y superfina 45 pc).
// Ancho de 0,55 kpc ilustrativo.
export const BARRA = { angulo: -28, semilargo: 4.6, ancho: 0.55, M: 1e10, U: 2.5, temperatura: 4300 };
// Reid et al. 2019 (ApJ 885, 131), tabla 2: β en grados (0 hacia el Sol, crece con el giro), R_q y ancho en kpc, ψ antes/después del quiebre.
export const BRAZOS = [
  { id: 'norma',    b: [5, 54],    bq: 18, Rq: 4.46,  pm: -1.0, pM: 19.5, w: 0.14 },
  { id: 'escudo',   b: [0, 104],   bq: 23, Rq: 4.91,  pm: 14.1, pM: 12.1, w: 0.23, viejo: true },
  { id: 'sagitario',b: [2, 97],    bq: 24, Rq: 6.04,  pm: 17.1, pM: 1.0,  w: 0.27 },
  { id: 'local',    b: [-8, 34],   bq: 9,  Rq: 8.26,  pm: 11.4, pM: 11.4, w: 0.31, espolon: true },
  { id: 'perseo',   b: [-23, 115], bq: 40, Rq: 8.87,  pm: 10.3, pM: 8.7,  w: 0.35, viejo: true },
  { id: 'exterior', b: [-16, 71],  bq: 18, Rq: 12.24, pm: 3.0,  pM: 9.4,  w: 0.65 },
];
export const PSI_EXTRAPOLADO = 12;   // ilustrativo: paso fuera del tramo medido si el medido es casi circular
export const ANCHO_POR_KPC = 0.042;  // Reid et al. 2014/2019: el ancho crece 42 pc por kpc
// Gas (McMillan 2017, MNRAS 465, 76): Σ(R) = Σ0·exp(−Rm/R − R/Rd) en M☉/pc²; z_d de la sech².
export const HI = { S0: 53.1, Rd: 7, Rm: 4, zd: 0.085 }, H2 = { S0: 2180, Rd: 1.5, Rm: 12, zd: 0.045 };
// Zona Molecular Central (forma según Ferrière, Gillard y Jean 2007, ilustrativa): elipse de 0,25 × 0,10 kpc girada como el bulbo,
// z_d 30 pc; Σc se ajusta en el horneado para que A_V(Sol → Sgr A*) = 25 mag (Fritz et al. 2011: A_Ks = 2,42).
export const CMZ = { a: 0.25, b: 0.10, zd: 0.030, Sc: null };
// Güver y Özel 2009: N_H = 2,21e21 cm⁻² por magnitud de A_V; 1 M☉/pc² de gas con X = 0,74 → 9,24e19 H/cm² → 0,0418 mag.
export const AV_POR_MSOL_PC2 = 0.0418;
export const R0 = 8.122;
export function radioBrazo(a, beta) {
  const bq = a.bq * D2R, psi = beta < bq ? a.pm : a.pM;
  if (beta >= a.b[0] * D2R && beta <= a.b[1] * D2R) return { R: a.Rq * Math.exp(-(beta - bq) * Math.tan(psi * D2R)), medido: true, fuera: 0 };
  const extremo = beta < a.b[0] * D2R ? a.b[0] * D2R : a.b[1] * D2R;
  const psiExtremo = extremo < bq ? a.pm : a.pM;
  const psiE = Math.abs(psiExtremo) < 5 ? PSI_EXTRAPOLADO : psiExtremo;
  const Re = a.Rq * Math.exp(-(extremo - bq) * Math.tan(psiExtremo * D2R));
  return { R: Re * Math.exp(-(beta - extremo) * Math.tan(psiE * D2R)), medido: false, fuera: Math.abs(beta - extremo) };
}
// Campo de brazos en (x, y): [jóvenes y gas, viejos]. Gaussiana en la distancia radial al centro del brazo; extrapolado: atenuado.
export function brazos(x, y) {
  const R = Math.hypot(x, y); if (R < 2.5) return [0, 0];
  const beta0 = Math.atan2(y, -x);
  let joven = 0, viejo = 0;
  for (const a of BRAZOS) {
    let mejor = null;
    for (let k = -2; k <= 2; k++) { const r = radioBrazo(a, beta0 + 2 * Math.PI * k); const d = Math.abs(R - r.R); if (!mejor || d < mejor.d) mejor = { d, ...r }; }
    const w = a.w + ANCHO_POR_KPC * (R - a.Rq);
    let g = Math.exp(-0.5 * (mejor.d * Math.cos(12 * D2R) / Math.max(0.1, w)) ** 2);
    if (!mejor.medido) { const lim = (a.espolon ? 25 : 200) * D2R; g *= 0.8 * (1 - ss(lim * 0.5, lim, mejor.fuera)); }
    g *= ss(3.0, 4.0, R) * (1 - ss(15.5, 18, R));
    joven += g; if (a.viejo) viejo += g;
  }
  return [joven, viejo];
}
export const sigmaGas = (g, R) => g.S0 * Math.exp(-g.Rm / Math.max(R, 0.05) - R / g.Rd);
export function ejes(x, y, grados) { const p = grados * D2R, c = Math.cos(p), s = Math.sin(p); return [c * x + s * y, -s * x + c * y]; }
export function sigmaCmz(x, y) { const [xb, yb] = ejes(x, y, BULBO.angulo); return (CMZ.Sc ?? 0) * Math.exp(-(((xb / CMZ.a) ** 2 + (yb / CMZ.b) ** 2) ** 2)); }
// Altura de escala exponencial equivalente del polvo (misma densidad en el plano que la sech²: h = 2·z_d), ponderada por el gas.
export function hPolvoModelo(x, y) {
  const R = Math.hypot(x, y), sHI = sigmaGas(HI, R), sH2 = sigmaGas(H2, R), sC = sigmaCmz(x, y);
  return (sHI * 2 * HI.zd + sH2 * 2 * H2.zd + sC * 2 * CMZ.zd) / Math.max(sHI + sH2 + sC, 1e-9);
}
// Ruido de valor con semilla (ilustrativo): grumos de formación estelar y filamentos de polvo.
function hash(i, j, s) { let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 2147483647)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function ruido(x, y, s) { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return (hash(i, j, s) * (1 - u) + hash(i + 1, j, s) * u) * (1 - v) + (hash(i, j + 1, s) * (1 - u) + hash(i + 1, j + 1, s) * u) * v; }
export function fbm(x, y, s, oct = 5) { let a = 0, amp = 0.5, f = 1; for (let o = 0; o < oct; o++) { a += amp * ruido(x * f, y * f, s + o); f *= 2.03; amp *= 0.5; } return a / (1 - 0.5 ** oct); }
// Densidad superficial de masa (M☉/pc²) sin normalizar de bulbo y barra; el horneado las escala a sus masas.
export function columnaBulbo(x, y) {
  const [xb, yb] = ejes(x, y, BULBO.angulo);
  const caja = Math.exp(-((Math.max(0, Math.abs(xb) - BULBO.caja[0]) / BULBO.suavidad) ** 2)) * Math.exp(-((Math.max(0, Math.abs(yb) - BULBO.caja[1]) / BULBO.suavidad) ** 2));
  let s = 0; const n = 64, zmax = 2.0;
  for (let k = 0; k < n; k++) {
    const z = (k + 0.5) / n * zmax;
    // De frente la X no se ve: la columna usa la altura base; la forma de X la pone el sombreador (hBulbo).
    s += 2 * Math.exp(-Math.hypot(xb / BULBO.ax, yb / BULBO.ay, z / BULBO.az)) * zmax / n;
  }
  return s * caja;
}
export function columnaBarra(x, y) {
  const [xl, yl] = ejes(x, y, BARRA.angulo);
  return 1 / (1 + Math.exp((Math.abs(xl) - BARRA.semilargo) / 0.25)) * Math.exp(-0.5 * (yl / BARRA.ancho) ** 2);
}
export const discoR = (d, R) => d.M / (2 * Math.PI * (d.Rd * 1e3) ** 2) * Math.exp(-R / d.Rd);   // M☉/pc²
// Color de cuerpo negro (misma aproximación que temperaturaARgb de gaiaCapa.js), lineal y con luminancia 1.
export function colorTemperatura(T) {
  const t = T / 100; let r, g, b;
  if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307; }
  else { r = 329.698727446 * (t - 60) ** -0.1332047592; g = 288.1221695283 * (t - 60) ** -0.0755148492; b = 255; }
  const lin = v => { const c = Math.max(0, Math.min(255, v)) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const c = [r, g, b].map(lin), Y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return c.map(v => v / Y);
}
export const COLOR_HII = (() => { const c = [1.0, 0.10, 0.25], Y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; return c.map(v => v / Y); })();
// Planta sin normalizar: luminosidades superficiales (L☉/pc², salvo bulbo y barra que se escalan después) y gas.
export function planta(x, y) {
  const R = Math.hypot(x, y);
  const borde = 1 - ss(14, 20, R), hueco = 1 - 0.7 * Math.exp(-((R / 2.8) ** 4));
  const [ab, av] = brazos(x, y);
  const f = 1 + 0.12 / Math.max(R, 0.5);                 // polvo 0,12 kpc hacia el lado interior del brazo (ilustrativo)
  const [abPolvo] = brazos(x * f, y * f);
  const grumo = fbm(x * 5.1, y * 5.1, 11) ** 2.2 * 2.2;  // asociaciones OB y regiones HII (ilustrativo)
  const fil = (1 - Math.abs(2 * fbm(x * 3.74, y * 3.74, 29) - 1)) ** 3;  // filamentos de polvo (ilustrativo)
  const fino0 = discoR(FINO, R) * borde;
  const joven = 1.1 * fino0 * ab * grumo * ss(3.0, 4.5, R) / FINO.U;
  return {
    fino: fino0 * hueco * (1 + 0.25 * av) / FINO.U,
    grueso: discoR(GRUESO, R) * borde / GRUESO.U,
    joven, hii: 0.15 * joven * Math.min(1, Math.max(0, (grumo - 1.3) / 0.7)),
    modHI: 0.3 + 2.2 * abPolvo * (0.4 + 0.9 * fil), modH2: 0.2 + 2.86 * abPolvo * (0.3 + 1.2 * fil),
  };
}
