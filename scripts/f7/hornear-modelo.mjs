// Opción B de F7: hornea la planta del modelo publicado en el mismo formato que la opción A.
// Uso: node scripts/f7/hornear-modelo.mjs [N=2048] [carpeta=public/textures/galaxy] [json=src/f7/modeloB.json] [mapasEsa=src/f7/mapasEsa.json]
// Salidas: f7-modelo-emision.png (N², RGB sRGB, emisión sin polvo / E_max) y f7-modelo-polvo.png (N/2², RGB:
//   R = codificarTau(τ_V de frente), G = codificarHPolvo(altura del polvo), B = f_joven/0,8).
import fs from 'node:fs';
import { pngRgb } from './png.mjs';
import * as B from '../../src/scene/galaxiaModeloB.js';
import { codificarTau, codificarHPolvo } from '../../src/scene/galaxiaModelo.js';
const [N = 2048, carpeta = 'public/textures/galaxy', salidaJson = 'src/f7/modeloB.json', jsonA = 'src/f7/mapasEsa.json'] = process.argv.slice(2).map((v, i) => (i === 0 ? Number(v) : v));
const W = 8122 / 0.20 / 1000, texel = W / N, areaPc2 = (texel * 1000) ** 2;
const coordenadas = (n, i) => { const v = Math.floor(i / n), u = i % n; return [-((v + 0.5) / n - 0.5) * W, -((u + 0.5) / n - 0.5) * W]; };
// 1) Planta a resolución N.
const campos = ['fino', 'grueso', 'joven', 'hii', 'bulbo', 'barra', 'modHI', 'modH2'];
const P = Object.fromEntries(campos.map(c => [c, new Float32Array(N * N)]));
let sumaBulbo = 0, sumaBarra = 0;
for (let i = 0; i < N * N; i++) {
  const [x, y] = coordenadas(N, i), p = B.planta(x, y);
  for (const c of ['fino', 'grueso', 'joven', 'hii', 'modHI', 'modH2']) P[c][i] = p[c];
  const R = Math.hypot(x, y);
  P.bulbo[i] = R < 4 ? B.columnaBulbo(x, y) : 0; P.barra[i] = R < 6.5 ? B.columnaBarra(x, y) : 0;
  sumaBulbo += P.bulbo[i]; sumaBarra += P.barra[i];
}
const kBulbo = B.BULBO.M / (sumaBulbo * areaPc2) / B.BULBO.U, kBarra = B.BARRA.M / (sumaBarra * areaPc2) / B.BARRA.U;   // L☉/pc²
// 2) Gas: modulación de brazos normalizada a media 1 por anillo de 500 pc (conserva el perfil radial de McMillan 2017).
const anillo = i => { const [x, y] = coordenadas(N, i); return Math.min(60, Math.floor(Math.hypot(x, y) / 0.5)); };
const media = c => { const s = new Float64Array(61), n = new Float64Array(61); for (let i = 0; i < N * N; i++) { const a = anillo(i); s[a] += P[c][i]; n[a]++; } return s.map((v, a) => v / Math.max(n[a], 1)); };
const mHI = media('modHI'), mH2 = media('modH2');
// 3) Emisión RGB lineal, fracción joven y τ_V de frente.
const C = { fino: B.colorTemperatura(B.FINO.temperatura), grueso: B.colorTemperatura(B.GRUESO.temperatura), viejo: B.colorTemperatura(B.BULBO.temperatura), joven: B.colorTemperatura(13000), hii: B.COLOR_HII };
const E = new Float32Array(3 * N * N), fJoven = new Float32Array(N * N), tauSinCmz = new Float32Array(N * N);
for (let i = 0; i < N * N; i++) {
  const [x, y] = coordenadas(N, i), R = Math.hypot(x, y), a = anillo(i);
  const lB = P.bulbo[i] * kBulbo + P.barra[i] * kBarra, total = P.fino[i] + P.grueso[i] + lB + P.joven[i] + P.hii[i];
  for (let c = 0; c < 3; c++) E[3 * i + c] = P.fino[i] * C.fino[c] + P.grueso[i] * C.grueso[c] + lB * C.viejo[c] + P.joven[i] * C.joven[c] + P.hii[i] * C.hii[c];
  fJoven[i] = total > 0 ? (P.joven[i] + P.hii[i]) / total : 0;
  const gas = B.sigmaGas(B.HI, R) * P.modHI[i] / mHI[a] + B.sigmaGas(B.H2, R) * P.modH2[i] / mH2[a];
  tauSinCmz[i] = B.AV_POR_MSOL_PC2 * gas / 1.0857;
}
// 4) CMZ: Σc tal que A_V(Sol → Sgr A*) = 25 mag (recta en el plano; burbuja local 80–200 pc; h_d de hPolvoModelo).
function avAlCentro(Sc) {
  B.CMZ.Sc = Sc; let av = 0; const n = 8000, L = B.R0;
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n, x = -B.R0 * (1 - t), y = 0, z = 0.0208 * (1 - t);
    const u = Math.round((0.5 - y / W) * N - 0.5), v = Math.round((0.5 - x / W) * N - 0.5), i = Math.min(N - 1, Math.max(0, v)) * N + Math.min(N - 1, Math.max(0, u));
    const tau = tauSinCmz[i] + B.AV_POR_MSOL_PC2 * B.sigmaCmz(x, y) / 1.0857;
    const h = B.hPolvoModelo(x, y), burbuja = Math.min(1, Math.max(0, (B.R0 * t - 0.08) / 0.12)) ** 2 * (3 - 2 * Math.min(1, Math.max(0, (B.R0 * t - 0.08) / 0.12)));
    av += 1.0857 * tau * Math.exp(-Math.abs(z) / h) / (2 * h) * burbuja * L / n;
  }
  return av;
}
const av0 = avAlCentro(0), av1 = avAlCentro(1000);
const Sc = Math.max(0, (25 - av0) / ((av1 - av0) / 1000));
B.CMZ.Sc = Sc;
// 5) Normalización con la opción A: misma luminancia media sin polvo en el anillo del Sol (7,6–8,6 kpc).
const lumA = JSON.parse(fs.readFileSync(jsonA, 'utf8')).lumSol;
let lumB = 0, nB = 0; for (let i = 0; i < N * N; i++) { const [x, y] = coordenadas(N, i), R = Math.hypot(x, y); if (R > 7.6 && R < 8.6) { lumB += 0.2126 * E[3 * i] + 0.7152 * E[3 * i + 1] + 0.0722 * E[3 * i + 2]; nB++; } }
const kA = lumA / (lumB / nB);
const maximos = Float32Array.from({ length: N * N }, (_, i) => Math.max(E[3 * i], E[3 * i + 1], E[3 * i + 2]) * kA).sort();
const eMax = maximos[Math.floor(0.999 * (N * N - 1))];
const oetf = v => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const q = v => Math.round(Math.min(1, Math.max(0, v)) * 255);
const rgbE = new Uint8Array(3 * N * N);
for (let i = 0; i < 3 * N * N; i++) rgbE[i] = q(oetf(Math.min(1, E[i] * kA / eMax)));
fs.writeFileSync(`${carpeta}/f7-modelo-emision.png`, pngRgb(rgbE, N, N));
// 6) Mapa de polvo a N/2 (promedio 2×2): τ codificado, altura del polvo (ponderada por el gas; la emisión ya es intrínseca), f_joven/0,8.
const M = N / 2, rgbP = new Uint8Array(3 * M * M);
for (let v = 0; v < M; v++) for (let u = 0; u < M; u++) {
  let tau = 0, fj = 0, h = 0;
  for (const [dv, du] of [[0, 0], [0, 1], [1, 0], [1, 1]]) { const i = (2 * v + dv) * N + 2 * u + du, [x, y] = coordenadas(N, i); tau += tauSinCmz[i] + B.AV_POR_MSOL_PC2 * B.sigmaCmz(x, y) / 1.0857; fj += fJoven[i]; h += B.hPolvoModelo(x, y); }
  const j = v * M + u; rgbP[3 * j] = q(codificarTau(tau / 4)); rgbP[3 * j + 1] = q(codificarHPolvo(h / 4)); rgbP[3 * j + 2] = q(fj / 4 / 0.8);
}
fs.writeFileSync(`${carpeta}/f7-modelo-polvo.png`, pngRgb(rgbP, M, M));
// 7) Comprobaciones (también en scripts/galaxia.test.js).
const sigmaEstelar = B.discoR({ ...B.FINO }, B.R0) + B.discoR({ ...B.GRUESO }, B.R0);
const gasSol = B.sigmaGas(B.HI, B.R0) + B.sigmaGas(B.H2, B.R0);
const hSol = B.hPolvoModelo(-B.R0, 0), avPlanoSol = B.AV_POR_MSOL_PC2 * gasSol / (2 * hSol);
const col = [0, 0, 0]; for (let i = 0; i < N * N; i++) for (let c = 0; c < 3; c++) col[c] += E[3 * i + c];
const resumen = { N, escalaE: +eMax.toPrecision(5), cmzSigma: +Sc.toFixed(1), avCentroSinCmz: +av0.toFixed(2), avCentro: +avAlCentro(Sc).toFixed(2),
  sigmaEstelarSol: +sigmaEstelar.toFixed(1), sigmaGasSol: +gasSol.toFixed(2), hPolvoSol: +hSol.toFixed(4), avPlanoSolMagKpc: +avPlanoSol.toFixed(2),
  colorIntegrado: col.map(v => +(v / col[1]).toFixed(3)), color5000K: B.colorTemperatura(5000).map((v, _, a) => +(v / a[1]).toFixed(3)), luzTotalLsol: +(col.reduce((a, b) => a + b, 0) / 3 * areaPc2).toPrecision(3) };
fs.writeFileSync(salidaJson, JSON.stringify(resumen, null, 1) + '\n');
console.log(resumen);
