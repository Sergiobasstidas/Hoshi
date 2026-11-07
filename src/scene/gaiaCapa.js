// Lectura de public/data/gaia-1m.bin (lo genera scripts/process_gaia.js) y tablas de color.
// Sin objetos por estrella: las vistas tipadas apuntan al mismo ArrayBuffer descargado.
import { vividStellarColor } from './stellarAppearance.js';

export const GAIA_URL = '/data/gaia-1m.bin';
export const GAIA_FIRMA = 'HGAI';
export const GAIA_VERSION = 1;
const HEADER_BYTES = 16;

// Cuantización (ver el encabezado de scripts/process_gaia.js).
export const M_MIN = -12, M_STEP = 0.125;
export const C_MIN = -1, C_STEP = 0.035, C_NONE = 255;

export function leerGaia(buffer) {
  const view = new DataView(buffer);
  const firma = String.fromCharCode(...new Uint8Array(buffer, 0, 4));
  const version = view.getUint32(4, true), n = view.getUint32(8, true);
  if (firma !== GAIA_FIRMA || version !== GAIA_VERSION || buffer.byteLength !== HEADER_BYTES + 14 * n) {
    throw new Error(`gaia-1m.bin: formato inesperado (${firma} v${version}, ${buffer.byteLength} bytes)`);
  }
  return {
    n,
    posiciones: new Float32Array(buffer, HEADER_BYTES, 3 * n),
    magnitudes: new Uint8Array(buffer, HEADER_BYTES + 12 * n, n),
    colores: new Uint8Array(buffer, HEADER_BYTES + 13 * n, n),
  };
}

export const magnitudG = byte => M_MIN + byte * M_STEP;
export const bpRpDeByte = byte => (byte === C_NONE ? null : C_MIN + byte * C_STEP);

// G − V de Riello et al. (2021), tabla C.2, válida para −0,5 < BP−RP < 5 (fuera se usa el borde).
export function gMenosV(bpRp) {
  if (bpRp === null) return 0;
  const c = Math.min(5, Math.max(-0.5, bpRp));
  return -0.02704 + 0.01424 * c - 0.2156 * c * c + 0.01426 * c ** 3;
}

// B−V desde BP−RP. Riello et al. (2021) no publica esta relación, así que se usa la mediana de B−V
// (AT-HYG) por intervalo de BP−RP (Gaia DR3) de las ~89 000 estrellas HIP de Hoshi con un solo vecino
// Gaia y RUWE < 1,4 (data/raw/gaia/gaia_dr3_hip.csv). Así el color coincide con el de StarField.
// Más allá de BP−RP ≈ 2,35 el B−V de Hipparcos se aplana (~1,65), y se mantiene ese valor.
const TABLA_BV = [
  [-0.35, -0.208], [-0.05, -0.042], [0.25, 0.180], [0.55, 0.417], [0.85, 0.675],
  [1.15, 0.990], [1.45, 1.281], [1.75, 1.520], [2.05, 1.630], [2.35, 1.653],
];
export function bvDesdeBpRp(bpRp) {
  if (bpRp <= TABLA_BV[0][0]) return TABLA_BV[0][1];
  for (let k = 1; k < TABLA_BV.length; k++) {
    const [x1, y1] = TABLA_BV[k];
    if (bpRp <= x1) {
      const [x0, y0] = TABLA_BV[k - 1];
      return y0 + (y1 - y0) * (bpRp - x0) / (x1 - x0);
    }
  }
  return TABLA_BV[TABLA_BV.length - 1][1];
}

// Las mismas fórmulas que scripts/process_stars.js: Ballesteros (2012) y Tanner Helland.
const bvATemperatura = bv => 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
function temperaturaARgb(temp) {
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

// Tabla de 256 entradas (una por byte de color) para una textura RGBA: rgb = color vivo de
// StarField y a = G − V, que el shader resta a la magnitud absoluta G para obtener la V.
export function tablaColores() {
  const datos = new Float32Array(256 * 4);
  for (let byte = 0; byte < 256; byte++) {
    const bpRp = bpRpDeByte(byte);
    const rgb = bpRp === null ? [255, 255, 255] : temperaturaARgb(bvATemperatura(bvDesdeBpRp(bpRp)));
    datos.set([...vividStellarColor(rgb), gMenosV(bpRp)], byte * 4);
  }
  return datos;
}

// Escalas de grupo de buildStellarAppearance (área de marcadores y energía), calculadas con un
// histograma de pares (magnitud, color) en lugar de recorrer objetos.
export function escalasDeGrupo(magnitudes, colores, gMenosVPorByte) {
  const conteo = new Uint32Array(65536);
  for (let k = 0; k < magnitudes.length; k++) conteo[(magnitudes[k] << 8) | colores[k]]++;
  let area = 0, energia = 0, luz = 0;
  for (let par = 0; par < 65536; par++) {
    const veces = conteo[par];
    if (!veces) continue;
    const v = magnitudG(par >> 8) - gMenosVPorByte[par & 255];
    const marcador = 0.45 + 1.8 / (1 + Math.exp((v - 1) * 0.5));
    area += veces * marcador ** 2;
    energia += veces * Math.max(0.45, Math.min(1.5, 2 ** ((1.3 - v) * 0.15))) * marcador ** 2;
    luz += veces * Math.max(0.65, Math.min(1.15, 1 - v * 0.018));
  }
  const areaScale = area ? Math.sqrt(magnitudes.length / area) : 1;
  const energyScale = energia ? luz / (energia * areaScale ** 2) : 1;
  return { areaScale, energyScale };
}
