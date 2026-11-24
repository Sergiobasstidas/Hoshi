// Opción A de F7: deriva de la imagen ESA/Gaia/DPAC (CC BY-SA 3.0 IGO) el mapa de polvo y fracción joven que usa el volumen.
// Uso: node scripts/f7/mapas-esa.mjs [imagen.jpg] [salida.png] [salida.json]
// Salida: PNG RGB 1024² en la misma orientación que la JPEG (fila 0 arriba):
//   R = codificarTau(τ_V de frente), G = (1/T_cara − 1)/2 (corrección de columna), B = f_joven/0,8.
import fs from 'node:fs';
import { pngRgb } from './png.mjs';
import { leerImagen, reducir } from './imagen.mjs';
import { codificarTau } from '../../src/scene/galaxiaModelo.js';
const [jpg = 'public/textures/galaxy/gaia-milky-way-2025.jpg', salidaPng = 'public/textures/galaxy/f7-esa-polvo.png', salidaJson = 'src/f7/mapasEsa.json'] = process.argv.slice(2);
const N = 1024, W_PC = 8122 / 0.20, R_SOL = 8122;
const crudo = reducir(leerImagen(jpg), N);   // 2048² → 1024² por promedio de bloques 2×2
const lin = c => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const canal = k => Float64Array.from({ length: N * N }, (_, i) => lin(crudo[3 * i + k]));
const srgb = k => Float64Array.from({ length: N * N }, (_, i) => crudo[3 * i + k] / 255);
const [lr, lg, lb] = [0, 1, 2].map(canal), [sr, sg, sb] = [0, 1, 2].map(srgb);
// Coordenadas galactocéntricas (pc) de cada texel, como galaxy.js: fila v (0 arriba) → x = −(v−0,5)·W; columna u → y = −(u−0,5)·W.
const X = new Float64Array(N * N), Y = new Float64Array(N * N), R = new Float64Array(N * N);
for (let v = 0; v < N; v++) for (let u = 0; u < N; u++) { const i = v * N + u; X[i] = -((v + 0.5) / N - 0.5) * W_PC; Y[i] = -((u + 0.5) / N - 0.5) * W_PC; R[i] = Math.hypot(X[i], Y[i]); }
const L = Float64Array.from({ length: N * N }, (_, i) => 0.2126 * lr[i] + 0.7152 * lg[i] + 0.0722 * lb[i]);
// 1) Ángulo de la barra: momentos de segundo orden de la luz de R < 3 kpc sobre el percentil 80 de esa zona.
const percentil = (arr, p) => { const a = Float64Array.from(arr).sort(); return a[Math.min(a.length - 1, Math.floor(p / 100 * (a.length - 1)))]; };
const zona = []; for (let i = 0; i < N * N; i++) if (R[i] < 3000) zona.push(L[i]);
const umbral = percentil(zona, 80);
let sw = 0, sx = 0, sy = 0; for (let i = 0; i < N * N; i++) if (R[i] < 3000 && L[i] > umbral) { sw += L[i]; sx += L[i] * X[i]; sy += L[i] * Y[i]; }
sx /= sw; sy /= sw;
let cxx = 0, cyy = 0, cxy = 0; for (let i = 0; i < N * N; i++) if (R[i] < 3000 && L[i] > umbral) { const w = L[i] / sw; cxx += w * (X[i] - sx) ** 2; cyy += w * (Y[i] - sy) ** 2; cxy += w * (X[i] - sx) * (Y[i] - sy); }
const barraGrados = 0.5 * Math.atan2(2 * cxy, cxx - cyy) * 180 / Math.PI;
// 2) Mediana 3×3 por canal (quita el granulado de estrellas pintadas).
function mediana3(a) {
  const o = new Float64Array(N * N), v = new Float64Array(9);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let k = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = Math.min(N - 1, Math.max(0, y + dy)), xx = Math.min(N - 1, Math.max(0, x + dx)); v[k++] = a[yy * N + xx]; }
    v.sort(); o[y * N + x] = v[4];
  }
  return o;
}
const [cr, cg, cb] = [lr, lg, lb].map(mediana3);
const Lc = Float64Array.from({ length: N * N }, (_, i) => 0.2126 * cr[i] + 0.7152 * cg[i] + 0.0722 * cb[i]);
// 3) Envolvente local: gauss(σ 1) → máximo 7×7 → gauss(σ 6); oscuridad = 1 − L/envolvente.
function gauss(a, s) {
  const r = Math.ceil(3 * s), k = Float64Array.from({ length: 2 * r + 1 }, (_, i) => Math.exp(-((i - r) ** 2) / (2 * s * s)));
  const suma = k.reduce((p, q) => p + q, 0); k.forEach((_, i) => { k[i] /= suma; });
  const refl = (i) => (i < 0 ? -i - 1 : i >= N ? 2 * N - i - 1 : i);
  const t = new Float64Array(N * N), o = new Float64Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let s2 = 0; for (let j = -r; j <= r; j++) s2 += k[j + r] * a[y * N + refl(x + j)]; t[y * N + x] = s2; }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let s2 = 0; for (let j = -r; j <= r; j++) s2 += k[j + r] * t[refl(y + j) * N + x]; o[y * N + x] = s2; }
  return o;
}
function maximo(a, n) {
  const r = n >> 1, t = new Float64Array(N * N), o = new Float64Array(N * N), cl = i => Math.min(N - 1, Math.max(0, i));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let m = -Infinity; for (let j = -r; j <= r; j++) m = Math.max(m, a[y * N + cl(x + j)]); t[y * N + x] = m; }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let m = -Infinity; for (let j = -r; j <= r; j++) m = Math.max(m, t[cl(y + j) * N + x]); o[y * N + x] = m; }
  return o;
}
const env = gauss(maximo(gauss(Lc, 1), 7), 6);
const tau = new Float64Array(N * N), fJoven = new Float64Array(N * N), T = new Float64Array(N * N);
const mod = new Float64Array(N * N);
for (let i = 0; i < N * N; i++) {
  const e = Math.max(env[i], Lc[i]);
  const oscuro = Math.min(1, Math.max(0, 1 - Lc[i] / Math.max(e, 1e-6)));
  const rojo = Math.min(1, Math.max(0, (cr[i] - cb[i]) / Math.max(cr[i] + cb[i], 1e-6) * 3 + 0.5));
  const dentro = 1 - Math.min(1, Math.max(0, (R[i] - 15000) / 3000));
  mod[i] = 0.25 + 3.0 * oscuro * rojo * dentro;
}
// 4) τ de frente: radial publicado (0,165 en R☉, escala 3,192 kpc; Li et al. 2018) × modulación normalizada por anillos de 500 pc.
const sumaAnillo = new Float64Array(61), cuentaAnillo = new Float64Array(61);
for (let i = 0; i < N * N; i++) { const a = Math.min(60, Math.floor(R[i] / 500)); sumaAnillo[a] += mod[i]; cuentaAnillo[a]++; }
for (let i = 0; i < N * N; i++) {
  const a = Math.min(60, Math.floor(R[i] / 500)), dentro = 1 - Math.min(1, Math.max(0, (R[i] - 15000) / 3000));
  tau[i] = Math.min(8, 0.165 * Math.exp(-(R[i] - R_SOL) / 3192) * mod[i] / (sumaAnillo[a] / cuentaAnillo[a]) * dentro);
}
// 5) Fracción joven: exceso azul y puntos rosados (HII) de la imagen.
for (let i = 0; i < N * N; i++) {
  const azul = Math.max(-1, Math.min(1, (cb[i] - cr[i]) / Math.max(cb[i] + cr[i], 1e-6)));
  const rosa = Math.min(1, Math.max(0, sr[i] - 0.5 * (sg[i] + sb[i]) - 0.08)) * 4;
  fJoven[i] = Math.min(0.8, Math.max(0, 0.15 + 1.2 * Math.max(azul, 0) + rosa));
}
// 6) Transmisión de frente de una capa estelar exponencial (300 pc vieja, 48 pc joven) a través de polvo exponencial de 103 pc.
function tablaT(he, hd = 103) {
  const z = Float64Array.from({ length: 241 }, (_, i) => -6 * he + 12 * he * i / 240);
  const p = z.map(v => Math.exp(-Math.abs(v) / he)); const s = p.reduce((a, b) => a + b, 0);
  return Float64Array.from({ length: 161 }, (_, k) => { const t = 8 * k / 160; let acc = 0;
    for (let i = 0; i < 241; i++) { const arriba = z[i] >= 0 ? 0.5 * Math.exp(-z[i] / hd) : 1 - 0.5 * Math.exp(z[i] / hd); acc += p[i] / s * Math.exp(-t * arriba); } return acc; });
}
const TV = tablaT(300), TJ = tablaT(48);
const interp = (tab, t) => { const f = Math.min(160, Math.max(0, t / 8 * 160)), k = Math.min(159, Math.floor(f)), r = f - k; return tab[k] * (1 - r) + tab[k + 1] * r; };
for (let i = 0; i < N * N; i++) T[i] = Math.max(0.35, (1 - fJoven[i]) * interp(TV, tau[i]) + fJoven[i] * interp(TJ, tau[i]));
// Salida
const rgb = new Uint8Array(N * N * 3), q = v => Math.round(Math.min(1, Math.max(0, v)) * 255);
for (let i = 0; i < N * N; i++) { rgb[3 * i] = q(codificarTau(tau[i])); rgb[3 * i + 1] = q((1 / T[i] - 1) / 2); rgb[3 * i + 2] = q(fJoven[i] / 0.8); }
fs.writeFileSync(salidaPng, pngRgb(rgb, N, N));
const anillo = r0 => { let s = 0, n = 0; for (let i = 0; i < N * N; i++) if (Math.abs(R[i] - r0) < 250) { s += tau[i]; n++; } return +(s / n).toFixed(3); };
let tMedia = 0, nT = 0; for (let i = 0; i < N * N; i++) if (R[i] < 15000) { tMedia += T[i]; nT++; }
// Luminancia lineal media de la emisión sin polvo (E_obs / T_cara) en el anillo del Sol: la opción B se normaliza a este valor.
let lumSol = 0, nSol = 0; for (let i = 0; i < N * N; i++) if (R[i] > 7600 && R[i] < 8600) { lumSol += L[i] / T[i]; nSol++; }
const resumen = { fuente: 'gaia-milky-way-2025.jpg (ESA/Gaia/DPAC, Stefan Payne-Wardenaar; CC BY-SA 3.0 IGO)', N, barraGrados: +barraGrados.toFixed(2),
  tauMedio: { 2000: anillo(2000), 4000: anillo(4000), 8122: anillo(8122), 12000: anillo(12000), 15000: anillo(15000) }, tCaraMedia: +(tMedia / nT).toFixed(3), lumSol: +(lumSol / nSol).toPrecision(5) };
fs.writeFileSync(salidaJson, JSON.stringify(resumen, null, 1) + '\n');
console.log(resumen);
