// src/scene/galaxiaModelo.js (rama f7-prototipos). Funciones puras, sin dibujo: las usan GalaxiaVolumen.jsx (presupuesto
// de muestras, punto negro, uniforms), galaxiaShaders.js (mismas constantes en GLSL) y las pruebas.
// Marco galactocéntrico de Hoshi en kpc: x del Sol hacia el centro (GALACTIC_X), y sentido de giro (GALACTIC_Y),
// z polo norte galáctico (GALACTIC_Z). El Sol está en (−8,121973; 0; +0,0208).
import { GALACTIC_X, GALACTIC_Y, GALACTIC_Z, GALAXY_CENTER, GALAXY_IMAGE_WIDTH_PC, galaxyOpacity } from './galaxy.js';
import { LIGHT_YEAR_PC, smoothRange } from './scale.js';

export const SOL_KPC = [-8.121973, 0, 0.0208];
export const ANCHO_PLANTA_KPC = GALAXY_IMAGE_WIDTH_PC / 1000;            // 40,61 kpc, igual que el plano de hoy
export const LOSA = { zMax: 4.0, rMax: 20.3, zSalida: 3.0 };              // kpc; recorte del rayo (ilustrativo)
export const PERFIL = {
  hDelgado: 0.30, hDelgadoBarra: 0.18, barraR: [3.0, 5.0],               // BHG16: 300 ± 50 pc; Wegg, Gerhard y Portail 2015: 180 pc bajo la barra
  hGrueso: 0.90, fGruesoSol: 0.06, escalaFGrueso: 8.67, fGruesoMax: 0.4,  // BHG16: 900 ± 180 pc; fracción de luz local con las masas de BHG16 y Υ 1,5/3
  hJoven: 0.048,                                                          // Bobylev y Bajkova 2016: HII 48 pc, OB 40 pc
  bulbo: { ax: 0.70, ay: 0.44, az: 0.18, xX: 1.5, anchoX: 0.5, amplitudX: 1.2, s50: 2.2 }, // Wegg y Gerhard 2013; BHG16 (la X es ilustrativa)
  hPolvo: 0.103,                                                          // Li et al. 2018 (opción A y C)
  ensanche: { escala: 7.18, tope: 3 },                                    // Uppal et al. 2024 (arXiv:2311.09616), grumo rojo
  alabeo: { a: 0.060, r0: 7.72, potencia: 1.33, fase: 17.5 },             // Chen et al. 2019 (cefeidas)
  burbuja: [0.08, 0.20],                                                  // Burbuja Local (Pelgrims et al. 2020; Zucker et al. 2022), kpc
};
export const EXT_RGB = [0.891, 1.0, 1.236];                                // Cardelli, Clayton y Mathis 1989, R_V = 3,1, a 610/550/465 nm
export const CERCA = { emision: [1.5, 4.0], polvo: [0.03, 0.05] };         // kpc desde la cámara (ilustrativo)
export const PASO = { cz: 0.5, hMin: 0.15, ct: 0.25, tMin: 0.03, dtMin: 0.01, dtMax: 4.0, dh: { pc: 1.0, tel: 1.5 }, nMax: { pc: 48, tel: 32 } };
export const PASOS_TOPE_GLSL = 64;                                         // tope fijo del bucle del sombreador (uPasosMax ≤ 64)
export const PRESUPUESTO = { pc: 8e6, tel: 3e6, quieto: 4 };              // muestras por cuadro; ×4 una vez con la cámara quieta
export const ESCALAS = [0.25, 0.33, 0.5, 0.6, 0.75, 1];
export const TONO = { hombro: 0.8, factorFuera: 0.64, factorDentro: 0.85, interiorZ: [0.3, 3.0], interiorR: [16, 20] };
export const POLVO_B = { hMin: 0.04, hMax: 0.20 };                         // canal G del mapa de polvo de B: altura del polvo
export const GRUMOS = { sigma: 0.8, celda: 0.12, escala1: 7.68, escala2: 3.84, desfase2: 0.37, peso2: 0.7, norma: 1.22 };

const ss = smoothRange;
const D2R = Math.PI / 180;
export const lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

// Perfil vertical normalizado P(z,h) = e^(−|z|/h)/(2h) y su primitiva F(z,h) = signo(z)·(1 − e^(−|z|/h))/2.
export const perfilExp = (z, h) => Math.exp(-Math.abs(z) / h) / (2 * h);
export const primitivaExp = (z, h) => Math.sign(z) * (1 - Math.exp(-Math.abs(z) / h)) / 2;
// Integral de P a lo largo de un tramo recto de largo dt entre las alturas za y zb (exacta para P exponencial).
// Con |dz| < 0,001·h se usa el punto medio (en float32 la diferencia de primitivas pierde precisión).
export function integralTramo(za, zb, dt, h) {
  const dz = zb - za;
  if (Math.abs(dz) < 1e-3 * h) return perfilExp(0.5 * (za + zb), h) * dt;
  return dt * (primitivaExp(zb, h) - primitivaExp(za, h)) / dz;
}
export function alabeo(x, y) {
  const R = Math.hypot(x, y), A = PERFIL.alabeo;
  if (R <= A.r0) return 0;
  return A.a * (R - A.r0) ** A.potencia * Math.sin(Math.atan2(y, -x) - A.fase * D2R);
}
export const ensanche = R => Math.min(PERFIL.ensanche.tope, Math.exp(Math.max(0, R - Math.abs(SOL_KPC[0])) / PERFIL.ensanche.escala));
export const hDelgado = R => PERFIL.hDelgadoBarra + (PERFIL.hDelgado - PERFIL.hDelgadoBarra) * ss(R, ...PERFIL.barraR);
export const fGrueso = R => Math.min(PERFIL.fGruesoMax, PERFIL.fGruesoSol * Math.exp(-(R - Math.abs(SOL_KPC[0])) / PERFIL.escalaFGrueso));
// Ejes de la barra: ángulo φ (rad) del eje mayor medido desde +x hacia +y; con φ < 0 el extremo cercano queda en y > 0 (l > 0).
export function ejesBarra(x, y, phi) { const c = Math.cos(phi), s = Math.sin(phi); return [c * x + s * y, -s * x + c * y]; }
export function pesoBulbo(x, y, phi) {
  const [xb, yb] = ejesBarra(x, y, phi), B = PERFIL.bulbo;
  const s = Math.hypot(xb / B.ax, yb / B.ay);
  return Math.min(1, Math.exp(-((s / B.s50) ** 3) * Math.LN2));
}
export function hBulbo(x, y, phi) {
  const [xb] = ejesBarra(x, y, phi), B = PERFIL.bulbo, q = (Math.abs(xb) - B.xX) / B.anchoX;
  return B.az * (1 + B.amplitudX * Math.exp(-q * q));
}
// Rampa de entrada del volumen: «hoy» = galaxyOpacity (1.800 → 7.000 al); «temprana» = logarítmica 1.500 → 5.000 al.
export function rampaGalaxia(dPc, tipo = 'hoy') {
  if (tipo === 'temprana') return ss(Math.log10(dPc / LIGHT_YEAR_PC), Math.log10(1500), Math.log10(5000));
  return galaxyOpacity(dPc);
}
export const UMBRAL_PASE = 0.005;     // por debajo, el pase no se dibuja (a 2.000 al la rampa de hoy vale 0,0043)
// Posición de la cámara en kpc galactocéntricos, restada en doble precisión (camera.position + origin − centro).
export function camaraGalactica(position, origin) {
  const g = [position.x + origin[0] - GALAXY_CENTER[0], position.y + origin[1] - GALAXY_CENTER[1], position.z + origin[2] - GALAXY_CENTER[2]];
  return [GALACTIC_X, GALACTIC_Y, GALACTIC_Z].map(e => (g[0] * e[0] + g[1] * e[1] + g[2] * e[2]) / 1000);
}
export const aGalactico = v => [GALACTIC_X, GALACTIC_Y, GALACTIC_Z].map(e => v[0] * e[0] + v[1] * e[1] + v[2] * e[2]);
// Base de la cámara en el marco galáctico a partir de camera.matrixWorld.elements (columnas: derecha, arriba, atrás).
export function baseCamara(e) {
  const col = k => { const v = aGalactico([e[4 * k], e[4 * k + 1], e[4 * k + 2]]); const l = Math.hypot(...v); return v.map(c => c / l); };
  return [col(0), col(1), col(2)];
}
// Tramo del rayo dentro de la losa |z| ≤ zMax y del cilindro R ≤ rMax; null si no los toca.
export function intervaloLosa(o, d) {
  let t0 = 0, t1 = 1e9;
  if (Math.abs(d[2]) < 1e-9) { if (Math.abs(o[2]) > LOSA.zMax) return null; }
  else { let a = (-LOSA.zMax - o[2]) / d[2], b = (LOSA.zMax - o[2]) / d[2]; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); }
  const A = d[0] * d[0] + d[1] * d[1], B = 2 * (o[0] * d[0] + o[1] * d[1]), C = o[0] * o[0] + o[1] * o[1] - LOSA.rMax * LOSA.rMax;
  if (A < 1e-12) { if (C > 0) return null; }
  else { const D = B * B - 4 * A * C; if (D < 0) return null; const r = Math.sqrt(D); t0 = Math.max(t0, (-B - r) / (2 * A)); t1 = Math.min(t1, (-B + r) / (2 * A)); }
  return t1 > t0 ? [t0, t1] : null;
}
// Largo del paso en t (kpc) para el punto p: fino cerca del plano y de la cámara, largo lejos (regla única).
export function largoPaso(p, d, t, dh) {
  const z = p[2] - alabeo(p[0], p[1]);
  const dxy = Math.hypot(d[0], d[1]), dz = Math.abs(d[2]);
  const dt = Math.min(PASO.cz * Math.max(Math.abs(z), PASO.hMin) / Math.max(dz, 1e-3), PASO.ct * Math.max(t, PASO.tMin), dh / Math.max(dxy, 1e-3));
  return Math.min(PASO.dtMax, Math.max(PASO.dtMin, dt));
}
// Cantidad de pasos de un rayo (lo que usa la CPU para elegir la resolución; no lee mapas).
export function contarPasos(o, d, { nMax, dh }) {
  const iv = intervaloLosa(o, d); if (!iv) return 0;
  let t = Math.max(iv[0], PASO.tMin), n = 0;
  while (t < iv[1] && n < nMax) {
    const p = [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];
    const z = p[2] - alabeo(p[0], p[1]);
    if (Math.abs(z) > LOSA.zSalida && z * d[2] > 0) break;
    t += largoPaso(p, d, t, dh); n++;
  }
  return n;
}
// Escala de resolución por presupuesto de muestras: la mayor de ESCALAS con W·H·s²·n̄ ≤ B. Sin histéresis (función pura).
export function escalaPorPresupuesto(W, H, nMedio, B) {
  let s = ESCALAS[0];
  for (const e of ESCALAS) if (W * H * e * e * nMedio <= B) s = e;
  return s;
}
// Dirección del rayo de la cámara para NDC (nx, ny) ∈ [−1, 1]², en el marco galáctico.
export function rayo(base, tan, nx, ny) {
  const [derecha, arriba, atras] = base;
  const d = [0, 1, 2].map(k => nx * tan[0] * derecha[k] + ny * tan[1] * arriba[k] - atras[k]);
  const l = Math.hypot(...d); return d.map(v => v / l);
}
// n̄ con una rejilla de 8×5 rayos de la cámara.
export function pasosMedios(o, base, tan, opciones) {
  let suma = 0;
  for (let j = 0; j < 5; j++) for (let i = 0; i < 8; i++) suma += contarPasos(o, rayo(base, tan, ((i + 0.5) / 8) * 2 - 1, ((j + 0.5) / 5) * 2 - 1), opciones);
  return suma / 40;
}
// Gemela en JS del sombreador de marcha (pruebas y punto negro).
// mapa(x, y) → { E: [r,g,b] lineal ya multiplicado por corrección de columna, bordes y uLuz, tau, fJoven, hPolvo }.
export function integrarRayo(o, d, mapa, { nMax = 400, dh = 1.0, barra = -18.1 * D2R, cerca = true, jitter = 0.5, grumos = null } = {}) {
  const iv = intervaloLosa(o, d); if (!iv) return { C: [0, 0, 0], T: [1, 1, 1], n: 0 };
  let t = Math.max(iv[0], PASO.tMin);
  const C = [0, 0, 0], T = [1, 1, 1];
  let n = 0, primero = true;
  while (t < iv[1] && n < nMax) {
    const pa = [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];
    let dt = largoPaso(pa, d, t, dh);
    if (primero) { dt *= 0.5 + jitter; primero = false; }
    const tb = Math.min(t + dt, iv[1]); dt = tb - t;
    const tm = 0.5 * (t + tb);
    const pm = [o[0] + d[0] * tm, o[1] + d[1] * tm, o[2] + d[2] * tm];
    const R = Math.hypot(pm[0], pm[1]), zw = alabeo(pm[0], pm[1]), fl = ensanche(R);
    const za = pa[2] - zw, zb = o[2] + d[2] * tb - zw;
    const m = mapa(pm[0], pm[1]);
    const wb = pesoBulbo(pm[0], pm[1], barra), fT = fGrueso(R), fy = Math.min(m.fJoven, 1 - wb);
    const iDel = integralTramo(za, zb, dt, hDelgado(R) * fl), iGru = integralTramo(za, zb, dt, PERFIL.hGrueso * fl);
    const iJov = integralTramo(za, zb, dt, PERFIL.hJoven * fl), iBul = integralTramo(za, zb, dt, hBulbo(pm[0], pm[1], barra));
    const iPol = integralTramo(za, zb, dt, (m.hPolvo ?? PERFIL.hPolvo) * fl);
    const wE = cerca ? ss(tm, ...CERCA.emision) : 1, wD = cerca ? ss(tm, ...CERCA.polvo) : 1;
    const rSol = Math.hypot(pm[0] - SOL_KPC[0], pm[1] - SOL_KPC[1], pm[2] - SOL_KPC[2]);
    const perfil = (1 - fy - wb) * ((1 - fT) * iDel + fT * iGru) + fy * iJov + wb * iBul;
    let tauV = m.tau * iPol * wD * ss(rSol, ...PERFIL.burbuja);
    if (grumos) tauV *= grumos(pm, dt);
    for (let c = 0; c < 3; c++) {
      const tc = tauV * EXT_RGB[c];
      const f = tc > 1e-4 ? (1 - Math.exp(-tc)) / tc : 1 - 0.5 * tc;
      C[c] += T[c] * m.E[c] * perfil * wE * f;
      T[c] *= Math.exp(-tc);
    }
    t = tb; n++;
    if (Math.max(...T) < 0.01) break;
    const zf = o[2] + d[2] * t - zw;                 // misma altura de alabeo del tramo (igual que el sombreador)
    if (Math.abs(zf) > LOSA.zSalida && zf * d[2] > 0) break;
  }
  return { C, T, n };
}
// Codificación del τ_V de frente en 8 bits (canal R del mapa de polvo): logarítmica, ~3 % de precisión relativa hasta τ = 32.
export const TAU_CODIGO = { t0: 0.01, max: 32 };
export const codificarTau = tau => Math.log1p(Math.max(0, tau) / TAU_CODIGO.t0) / Math.log1p(TAU_CODIGO.max / TAU_CODIGO.t0);
export const decodificarTau = r => TAU_CODIGO.t0 * Math.expm1(r * Math.log1p(TAU_CODIGO.max / TAU_CODIGO.t0));
// Altura del polvo de B guardada en el canal G (0–1) de f7-modelo-polvo.png.
export const codificarHPolvo = h => (h - POLVO_B.hMin) / (POLVO_B.hMax - POLVO_B.hMin);
export const decodificarHPolvo = g => POLVO_B.hMin + (POLVO_B.hMax - POLVO_B.hMin) * g;

// ---- Tono (gemelo del sombreador) y punto negro dentro del disco ----
const oetf = v => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
export const hombro = x => (x < TONO.hombro ? x : TONO.hombro + (1 - TONO.hombro) * (1 - Math.exp(-(x - TONO.hombro) / (1 - TONO.hombro))));
// ι: 1 con la cámara dentro del disco (|z'| < 0,3 kpc, R < 16 kpc), 0 fuera (|z'| > 3 kpc o R > 20 kpc).
export function interiorGalaxia(cam) {
  const R = Math.hypot(cam[0], cam[1]), z = Math.abs(cam[2] - alabeo(cam[0], cam[1]));
  return (1 - ss(z, ...TONO.interiorZ)) * (1 - ss(R, ...TONO.interiorR));
}
// Luminancia del cielo fuera de la banda desde la cámara: la menor entre rayos a ±ALTURA_NEGRO de latitud en 4 acimuts.
// Con los polos (el borrador) el cielo a 20–30° quedaba como un velo pardo: el disco grueso y el bulbo se ven hasta ahí.
// Fuerza del punto negro: con 1,4 el cielo fuera de la banda queda oscuro desde dentro del disco (sin neblina parda).
export const NEGRO = 1.6;
export const ALTURA_NEGRO = 12 * D2R;
export function brilloPolo(cam, mapa, { altura = ALTURA_NEGRO, ...opciones } = {}) {
  let menor = Infinity;
  for (const signo of [1, -1]) for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4, c = Math.cos(altura);
    const r = integrarRayo(cam, [c * Math.cos(a), c * Math.sin(a), signo * Math.sin(altura)], mapa, { ...opciones, jitter: 0.5 });
    menor = Math.min(menor, lum(r.C));
  }
  return menor;
}
// N = negro·ι·expo·brilloPolo: lo que se resta en luminancia antes del hombro (los polos quedan negros con negro = 1).
export function puntoNegro(cam, mapa, { negro = NEGRO, expo = 1, altura = ALTURA_NEGRO, ...opciones } = {}) {
  const iota = interiorGalaxia(cam);
  if (negro <= 0 || iota <= 0) return { iota, N: 0 };
  return { iota, N: negro * iota * expo * brilloPolo(cam, mapa, { ...opciones, altura }) };
}
// Color de pantalla de un rayo (sin el tramado): igual que el final del sombreador de marcha.
export function tono(C, { expo = 1, N = 0, iota = 0 } = {}) {
  const x = C.map(v => v * expo), Y = lum(x);
  const k = Math.max(Y - N, 0) / Math.max(Y, 1e-9);
  const f = TONO.factorFuera + (TONO.factorDentro - TONO.factorFuera) * iota;
  return x.map(v => f * oetf(Math.min(1, Math.max(0, hombro(v * k)))));
}

// ---- Parámetros de cada cuadro (los usa GalaxiaVolumen.jsx; todo es función de la pose, sin estado) ----
// camara: { position: {x,y,z}, elementos: camera.matrixWorld.elements, fov (grados), aspecto }; lienzo: [W, H] del drawing buffer.
export function parametrosCuadro({ camara, origin, lienzo, telefono = false, quieto = false, muestras = null, mapa = null, negro = NEGRO, alturaNegro = ALTURA_NEGRO, expo = 1, barra = -18.1 * D2R }) {
  const o = camaraGalactica(camara.position, origin);
  const base = baseCamara(camara.elementos);
  const tanY = Math.tan(camara.fov * D2R / 2), tan = [tanY * camara.aspecto, tanY];
  const nMax = telefono ? PASO.nMax.tel : PASO.nMax.pc, dh = telefono ? PASO.dh.tel : PASO.dh.pc;
  const presupuesto = (muestras ?? (telefono ? PRESUPUESTO.tel : PRESUPUESTO.pc)) * (quieto ? PRESUPUESTO.quieto : 1);
  const nMedio = pasosMedios(o, base, tan, { nMax, dh });
  const s = escalaPorPresupuesto(lienzo[0], lienzo[1], Math.max(nMedio, 1), presupuesto);
  const ancho = Math.max(1, Math.round(lienzo[0] * s)), alto = Math.max(1, Math.round(lienzo[1] * s));
  const { iota, N } = mapa ? puntoNegro(o, mapa, { negro, altura: alturaNegro, expo, nMax, dh, barra }) : { iota: interiorGalaxia(o), N: 0 };
  return { o, base, tan, nMax, dh, nMedio, s, ancho, alto, pixAng: 2 * tanY / alto, iota, N };
}

// ---- Mapa en la CPU (copias de 256² de las texturas) para el punto negro ----
// emision, polvo: RGBA de getImageData (fila 0 arriba, igual que la imagen); n: lado. modeloB: true en la opción B.
const lin = c => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
export function crearMapaCpu({ emision, polvo, n, modeloB = false, escalaE = 1, luz = 1 }) {
  const W = ANCHO_PLANTA_KPC;
  const leer = (datos, px, py, k) => datos[4 * (Math.min(n - 1, Math.max(0, py)) * n + Math.min(n - 1, Math.max(0, px))) + k];
  const bilineal = (datos, u, v, k, f = x => x) => {
    const x = u * n - 0.5, y = v * n - 0.5, i = Math.floor(x), j = Math.floor(y), a = x - i, b = y - j;
    return (f(leer(datos, i, j, k)) * (1 - a) + f(leer(datos, i + 1, j, k)) * a) * (1 - b) + (f(leer(datos, i, j + 1, k)) * (1 - a) + f(leer(datos, i + 1, j + 1, k)) * a) * b;
  };
  return (x, y) => {
    const u = 0.5 - y / W, vImg = 0.5 - x / W, vTex = 1 - vImg;
    const borde1 = 1 - ss(Math.hypot(u - 0.5, vTex - 0.5), 0.42, 0.50);
    const borde2 = modeloB ? 1 : ss(Math.hypot((u - 0.5) * 1.3, vTex - 0.945), 0.045, 0.075);
    const r = bilineal(polvo, u, vImg, 0) / 255, g = bilineal(polvo, u, vImg, 1) / 255, b = bilineal(polvo, u, vImg, 2) / 255;
    const corr = EXT_RGB.map(e => (modeloB ? 1 : Math.min((1 + 2 * g) ** e, 1 / 0.35)));
    const E = [0, 1, 2].map(k => bilineal(emision, u, vImg, k, lin) * escalaE * corr[k] * borde1 * borde2 * luz);
    return { E, tau: decodificarTau(r), fJoven: 0.8 * b, hPolvo: modeloB ? decodificarHPolvo(g) : PERFIL.hPolvo };
  };
}
